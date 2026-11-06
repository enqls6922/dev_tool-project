import type { OpaqueBounds } from "./imageProcessor";

/**
 * Feet and horizontal center use the same cutoff as Pixel Cleaner.
 * Alpha 1–30 is ghost noise; a pixel counts only when alpha is above 30.
 * Kept as a literal so this module can run under the node test loader.
 */
export const MOTION_ALPHA_THRESHOLD = 30;

/** Same atlas edge cap as the packer. */
export const MOTION_MAX_EDGE = 8192;

/** Breathing room around the largest opaque box so the shared canvas is not flush. */
export const MOTION_CANVAS_PADDING = 4;

export const MOTION_FPS = [4, 6, 8, 12, 16] as const;
export type MotionFps = (typeof MOTION_FPS)[number];
export const DEFAULT_MOTION_FPS: MotionFps = 8;

export const SPRITESHEET_PNG = "Spritesheet.png";
export const SPRITESHEET_JSON = "Spritesheet.json";

export type FrameMetric = {
  bounds: OpaqueBounds | null;
};

export type FramePlacement = {
  destX: number;
  destY: number;
  bounds: OpaqueBounds | null;
};

export type MotionLayout = {
  canvasWidth: number;
  canvasHeight: number;
  tileWidth: number;
  tileHeight: number;
  /** Inclusive row where every frame's lowest opaque pixel is snapped. */
  yOffset: number;
  padding: number;
  placements: FramePlacement[];
};

export type MotionSheetFrame = {
  name: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MotionSheetDocument = {
  app: "SpriteForge";
  tool: "MotionStabilizer";
  version: 1;
  image: typeof SPRITESHEET_PNG;
  frameCount: number;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  fps: number;
  alphaThreshold: number;
  padding: number;
  yOffset: number;
  frames: MotionSheetFrame[];
};

export type RgbaFrame = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export function findMotionBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): OpaqueBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if ((pixels[row + x * 4 + 3] ?? 0) <= MOTION_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function normalizeMotionPadding(padding: number): number {
  if (!Number.isFinite(padding)) return MOTION_CANVAS_PADDING;
  return Math.max(0, Math.min(64, Math.round(padding)));
}

export function compareFileNames(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** Row used by the viewer guide. Prefer the pixel just under the contact row. */
export function guideRow(contactY: number, canvasHeight: number): number {
  if (!Number.isFinite(canvasHeight) || canvasHeight < 1) return 0;
  const contact = Number.isFinite(contactY) ? Math.round(contactY) : 0;
  if (contact + 1 < canvasHeight && contact + 1 >= 0) return contact + 1;
  return Math.min(canvasHeight - 1, Math.max(0, contact));
}

/**
 * Shared canvas from the largest opaque box, plus padding.
 * Each frame's foot (`maxY`) lands on `yOffset`. The box center lands on the
 * canvas center, rounded to a whole pixel so the sprite stays crisp.
 */
export function layoutMotionFrames(
  frames: readonly FrameMetric[],
  padding = MOTION_CANVAS_PADDING,
): MotionLayout | null {
  const pad = normalizeMotionPadding(padding);
  let maxWidth = 0;
  let maxHeight = 0;
  let solid = 0;
  for (const frame of frames) {
    if (!frame.bounds) continue;
    solid += 1;
    if (frame.bounds.width > maxWidth) maxWidth = frame.bounds.width;
    if (frame.bounds.height > maxHeight) maxHeight = frame.bounds.height;
  }
  if (solid === 0) return null;

  const canvasWidth = maxWidth + pad * 2;
  const canvasHeight = maxHeight + pad * 2;
  if (
    canvasWidth > MOTION_MAX_EDGE ||
    canvasHeight > MOTION_MAX_EDGE ||
    canvasWidth < 1 ||
    canvasHeight < 1
  ) {
    throw new Error(
      `공통 캔버스 ${canvasWidth}×${canvasHeight}px는 한도 ${MOTION_MAX_EDGE}px를 넘습니다.`,
    );
  }

  const yOffset = canvasHeight - 1 - pad;
  const canvasMid = (canvasWidth - 1) / 2;
  const placements = frames.map((frame): FramePlacement => {
    if (!frame.bounds) return { destX: 0, destY: 0, bounds: null };
    const minX = frame.bounds.x;
    const minY = frame.bounds.y;
    const maxX = minX + frame.bounds.width - 1;
    const maxY = minY + frame.bounds.height - 1;
    const destX = Math.round(canvasMid - (minX + maxX) / 2);
    const destY = yOffset - maxY;
    return { destX, destY, bounds: frame.bounds };
  });

  return {
    canvasWidth,
    canvasHeight,
    tileWidth: canvasWidth,
    tileHeight: canvasHeight,
    yOffset,
    padding: pad,
    placements,
  };
}

export function blitPixels(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  canvasWidth: number,
  canvasHeight: number,
): Uint8ClampedArray {
  if (source.length !== sourceWidth * sourceHeight * 4) {
    throw new Error("픽셀 버퍼 크기가 캔버스와 다릅니다.");
  }
  if (!Number.isInteger(destX) || !Number.isInteger(destY)) {
    throw new Error("배치 좌표는 정수여야 합니다.");
  }
  if (
    !Number.isInteger(canvasWidth) ||
    !Number.isInteger(canvasHeight) ||
    canvasWidth < 1 ||
    canvasHeight < 1
  ) {
    throw new Error("캔버스 크기가 올바르지 않습니다.");
  }
  const out = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  for (let y = 0; y < sourceHeight; y += 1) {
    const dy = destY + y;
    if (dy < 0 || dy >= canvasHeight) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const dx = destX + x;
      if (dx < 0 || dx >= canvasWidth) continue;
      const from = (y * sourceWidth + x) * 4;
      const to = (dy * canvasWidth + dx) * 4;
      out[to] = source[from] ?? 0;
      out[to + 1] = source[from + 1] ?? 0;
      out[to + 2] = source[from + 2] ?? 0;
      out[to + 3] = source[from + 3] ?? 0;
    }
  }
  return out;
}

export function packStripPixels(
  frames: readonly Uint8ClampedArray[],
  tileWidth: number,
  tileHeight: number,
): { pixels: Uint8ClampedArray; width: number; height: number } {
  if (frames.length === 0) {
    throw new Error("내보낼 프레임이 없습니다.");
  }
  if (!Number.isInteger(tileWidth) || !Number.isInteger(tileHeight) || tileWidth < 1 || tileHeight < 1) {
    throw new Error("타일 크기가 올바르지 않습니다.");
  }
  if (tileWidth > MOTION_MAX_EDGE || tileHeight > MOTION_MAX_EDGE) {
    throw new Error(`타일 ${tileWidth}×${tileHeight}px는 한도 ${MOTION_MAX_EDGE}px를 넘습니다.`);
  }
  if (frames.length > Math.floor(MOTION_MAX_EDGE / tileWidth)) {
    const width = tileWidth * frames.length;
    throw new Error(`스트립 ${width}×${tileHeight}px는 한도 ${MOTION_MAX_EDGE}px를 넘습니다.`);
  }
  const width = tileWidth * frames.length;
  const height = tileHeight;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const rowBytes = tileWidth * 4;
  frames.forEach((frame, index) => {
    if (frame.length !== tileWidth * tileHeight * 4) {
      throw new Error("프레임 크기가 타일과 다릅니다.");
    }
    for (let y = 0; y < tileHeight; y += 1) {
      const srcStart = y * rowBytes;
      const destStart = (y * width + index * tileWidth) * 4;
      pixels.set(frame.subarray(srcStart, srcStart + rowBytes), destStart);
    }
  });
  return { pixels, width, height };
}

export function buildMotionDocument(
  layout: MotionLayout,
  names: readonly string[],
  fps: number,
): MotionSheetDocument {
  if (names.length !== layout.placements.length) {
    throw new Error("프레임 이름이 배치와 맞지 않습니다.");
  }
  if (names.length === 0) {
    throw new Error("내보낼 프레임이 없습니다.");
  }
  const frameCount = names.length;
  if (frameCount > Math.floor(MOTION_MAX_EDGE / layout.tileWidth)) {
    throw new Error(
      `스트립 ${layout.tileWidth * frameCount}×${layout.tileHeight}px는 한도 ${MOTION_MAX_EDGE}px를 넘습니다.`,
    );
  }
  return {
    app: "SpriteForge",
    tool: "MotionStabilizer",
    version: 1,
    image: SPRITESHEET_PNG,
    frameCount,
    tileWidth: layout.tileWidth,
    tileHeight: layout.tileHeight,
    width: layout.tileWidth * frameCount,
    height: layout.tileHeight,
    fps,
    alphaThreshold: MOTION_ALPHA_THRESHOLD,
    padding: layout.padding,
    yOffset: layout.yOffset,
    frames: names.map((name, index) => ({
      name,
      index,
      x: index * layout.tileWidth,
      y: 0,
      width: layout.tileWidth,
      height: layout.tileHeight,
    })),
  };
}

/** Pure pipeline used by the canvas exporter and the unit tests. */
export function stabilizeBuffers(
  frames: readonly RgbaFrame[],
  padding = MOTION_CANVAS_PADDING,
): {
  layout: MotionLayout;
  frames: Uint8ClampedArray[];
  strip: { pixels: Uint8ClampedArray; width: number; height: number };
} | null {
  const metrics = frames.map((frame) => ({
    bounds: findMotionBounds(frame.pixels, frame.width, frame.height),
  }));
  const layout = layoutMotionFrames(metrics, padding);
  if (!layout) return null;
  const placed = frames.map((frame, index) => {
    const placement = layout.placements[index];
    if (!placement?.bounds) {
      return new Uint8ClampedArray(layout.canvasWidth * layout.canvasHeight * 4);
    }
    return blitPixels(
      frame.pixels,
      frame.width,
      frame.height,
      placement.destX,
      placement.destY,
      layout.canvasWidth,
      layout.canvasHeight,
    );
  });
  return {
    layout,
    frames: placed,
    strip: packStripPixels(placed, layout.tileWidth, layout.tileHeight),
  };
}

function canvasContext(canvas: HTMLCanvasElement, willReadFrequently = false): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", willReadFrequently ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
  return context;
}

function putPixels(canvas: HTMLCanvasElement, pixels: Uint8ClampedArray, width: number, height: number) {
  const context = canvasContext(canvas);
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
}

export function renderStabilizedCanvas(
  source: HTMLCanvasElement | null,
  destX: number,
  destY: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  let pixels: Uint8ClampedArray;
  if (!source) {
    pixels = new Uint8ClampedArray(width * height * 4);
  } else {
    const image = canvasContext(source, true).getImageData(0, 0, source.width, source.height);
    pixels = blitPixels(image.data, source.width, source.height, destX, destY, width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  putPixels(canvas, pixels, width, height);
  return canvas;
}

export function renderSpriteStrip(frames: readonly HTMLCanvasElement[]): HTMLCanvasElement {
  if (frames.length === 0) throw new Error("내보낼 프레임이 없습니다.");
  const tileWidth = frames[0]?.width ?? 0;
  const tileHeight = frames[0]?.height ?? 0;
  const buffers = frames.map((frame) => {
    if (frame.width !== tileWidth || frame.height !== tileHeight) {
      throw new Error("프레임 크기가 타일과 다릅니다.");
    }
    return canvasContext(frame, true).getImageData(0, 0, frame.width, frame.height).data;
  });
  const packed = packStripPixels(buffers, tileWidth, tileHeight);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = packed.height;
  putPixels(canvas, packed.pixels, packed.width, packed.height);
  return canvas;
}
