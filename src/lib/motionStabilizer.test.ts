import assert from "node:assert/strict";
import { test } from "node:test";
import { findOpaqueBounds, GHOST_ALPHA_MAX, MAX_ATLAS_EDGE } from "./imageProcessor.ts";
import {
  MOTION_ALPHA_THRESHOLD,
  MOTION_CANVAS_PADDING,
  MOTION_MAX_EDGE,
  SPRITESHEET_PNG,
  findMotionBounds,
  blitPixels,
  buildMotionDocument,
  compareFileNames,
  guideRow,
  layoutMotionFrames,
  packStripPixels,
  stabilizeBuffers,
  type RgbaFrame,
} from "./motionStabilizer.ts";

function blank(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

function fill(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha: number,
): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = 240;
      pixels[index + 1] = 32;
      pixels[index + 2] = 48;
      pixels[index + 3] = alpha;
    }
  }
}

function opaqueCount(pixels: Uint8ClampedArray): number {
  let count = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 0) > MOTION_ALPHA_THRESHOLD) count += 1;
  }
  return count;
}

function frame(width: number, height: number, paint: (pixels: Uint8ClampedArray) => void): RgbaFrame {
  const pixels = blank(width, height);
  paint(pixels);
  return { pixels, width, height };
}

test("motion feet ignore alpha 30 while ghost cleaning clears only alpha under 30", () => {
  assert.equal(MOTION_ALPHA_THRESHOLD, 30);
  assert.equal(GHOST_ALPHA_MAX, 29);
  assert.equal(MOTION_MAX_EDGE, MAX_ATLAS_EDGE);
  const width = 8;
  const height = 10;
  const pixels = blank(width, height);
  fill(pixels, width, 2, 2, 4, 5, 255);
  fill(pixels, width, 3, 8, 3, 8, 30);
  fill(pixels, width, 1, 1, 1, 1, 31);
  const expected = findOpaqueBounds(pixels, width, height, MOTION_ALPHA_THRESHOLD);
  assert.deepEqual(expected, { x: 1, y: 1, width: 4, height: 5 });
  assert.deepEqual(findMotionBounds(pixels, width, height), expected);
});

test("alpha 30 is ignored and alpha 31 defines the foot", () => {
  const width = 8;
  const height = 10;
  const pixels = blank(width, height);
  fill(pixels, width, 2, 2, 4, 5, 255);
  fill(pixels, width, 3, 8, 3, 8, 30);
  fill(pixels, width, 1, 1, 1, 1, 31);
  assert.deepEqual(findOpaqueBounds(pixels, width, height, MOTION_ALPHA_THRESHOLD), {
    x: 1,
    y: 1,
    width: 4,
    height: 5,
  });
});

test("feet share one baseline and box centers snap to the canvas center", () => {
  const frames = [
    frame(24, 24, (pixels) => {
      fill(pixels, 24, 2, 4, 9, 16, 255);
      fill(pixels, 24, 4, 20, 4, 20, 20);
    }),
    frame(24, 24, (pixels) => {
      fill(pixels, 24, 14, 10, 17, 18, 255);
    }),
    frame(24, 24, (pixels) => {
      fill(pixels, 24, 6, 8, 8, 12, 255);
    }),
  ];
  const stabilized = stabilizeBuffers(frames);
  assert.ok(stabilized);
  const { layout } = stabilized;
  assert.equal(layout.padding, MOTION_CANVAS_PADDING);
  assert.equal(layout.canvasWidth, 8 + MOTION_CANVAS_PADDING * 2);
  assert.equal(layout.canvasHeight, 13 + MOTION_CANVAS_PADDING * 2);
  assert.equal(layout.yOffset, layout.canvasHeight - 1 - layout.padding);

  const canvasMid = (layout.canvasWidth - 1) / 2;
  for (const [index, placed] of stabilized.frames.entries()) {
    const bounds = findOpaqueBounds(placed, layout.canvasWidth, layout.canvasHeight, MOTION_ALPHA_THRESHOLD);
    assert.ok(bounds, `frame ${index} kept opaque pixels`);
    assert.equal(bounds.y + bounds.height - 1, layout.yOffset);
    const mid = bounds.x + (bounds.width - 1) / 2;
    assert.ok(Math.abs(mid - canvasMid) <= 0.5);
    assert.ok(bounds.x >= layout.padding - 1);
    assert.ok(bounds.x + bounds.width <= layout.canvasWidth);
    assert.equal(opaqueCount(placed), opaqueCount(frames[index]?.pixels ?? blank(1, 1)));
  }

  const widest = findOpaqueBounds(
    stabilized.frames[0] ?? blank(1, 1),
    layout.canvasWidth,
    layout.canvasHeight,
    MOTION_ALPHA_THRESHOLD,
  );
  const tallest = widest;
  assert.equal(widest?.x, layout.padding);
  assert.equal(tallest?.y, layout.padding);
});

test("a frame with only ghost pixels stays blank and does not grow the canvas", () => {
  const solid = frame(12, 12, (pixels) => fill(pixels, 12, 2, 2, 5, 7, 255));
  const ghost = frame(30, 30, (pixels) => fill(pixels, 30, 0, 28, 4, 29, 30));
  const stabilized = stabilizeBuffers([solid, ghost, solid]);
  assert.ok(stabilized);
  assert.equal(stabilized.layout.canvasWidth, 4 + MOTION_CANVAS_PADDING * 2);
  assert.equal(stabilized.layout.canvasHeight, 6 + MOTION_CANVAS_PADDING * 2);
  assert.equal(opaqueCount(stabilized.frames[1] ?? blank(1, 1)), 0);
  assert.equal(stabilized.layout.placements[1]?.bounds, null);
  assert.equal(stabilized.strip.width, stabilized.layout.tileWidth * 3);
  assert.equal(stabilized.strip.height, stabilized.layout.tileHeight);
  assert.equal(opaqueCount(stabilized.strip.pixels), opaqueCount(stabilized.frames[0] ?? blank(1, 1)) * 2);
});

test("horizontal strip keeps frame order in one row", () => {
  const frames = [1, 2, 3].map((mark) =>
    frame(10, 10, (pixels) => {
      fill(pixels, 10, mark, 2, mark, 6, 255);
      const origin = (4 * 10 + mark) * 4;
      pixels[origin] = mark * 40;
    }),
  );
  const stabilized = stabilizeBuffers(frames, 2);
  assert.ok(stabilized);
  const { strip, layout } = stabilized;
  assert.equal(strip.width, layout.tileWidth * 3);
  assert.equal(strip.height, layout.tileHeight);
  for (let index = 0; index < 3; index += 1) {
    const mark = (index + 1) * 40;
    let inCell = false;
    let outside = false;
    const x0 = index * layout.tileWidth;
    const x1 = x0 + layout.tileWidth;
    for (let y = 0; y < strip.height; y += 1) {
      for (let x = 0; x < strip.width; x += 1) {
        const pixel = (y * strip.width + x) * 4;
        if ((strip.pixels[pixel] ?? 0) !== mark || (strip.pixels[pixel + 3] ?? 0) <= 30) continue;
        if (x >= x0 && x < x1) inCell = true;
        else outside = true;
      }
    }
    assert.equal(inCell, true, `frame ${index} stays in its cell`);
    assert.equal(outside, false, `frame ${index} does not spill`);
  }
});

test("all-empty input and an oversized box are rejected", () => {
  assert.equal(stabilizeBuffers([frame(4, 4, () => undefined)]), null);
  assert.equal(layoutMotionFrames([{ bounds: null }]), null);
  assert.throws(() => layoutMotionFrames([{ bounds: { x: 0, y: 0, width: 8192, height: 8 } }], 4));
  const huge = Array.from({ length: 5000 }, () => blank(2, 2));
  assert.throws(() => packStripPixels(huge, 2, 2));
});

test("sheet json records frame count, tile size, and a single-row layout", () => {
  const layout = layoutMotionFrames([
    { bounds: { x: 1, y: 2, width: 5, height: 9 } },
    { bounds: { x: 4, y: 6, width: 3, height: 4 } },
  ]);
  assert.ok(layout);
  const document = buildMotionDocument(layout, ["Walk_01", "Walk_02"], 8);
  assert.equal(document.image, SPRITESHEET_PNG);
  assert.equal(document.frameCount, 2);
  assert.equal(document.tileWidth, layout.tileWidth);
  assert.equal(document.tileHeight, layout.tileHeight);
  assert.equal(document.width, document.tileWidth * document.frameCount);
  assert.equal(document.height, document.tileHeight);
  assert.equal(document.fps, 8);
  assert.equal(document.alphaThreshold, 30);
  assert.equal(document.yOffset, layout.yOffset);
  assert.deepEqual(
    document.frames.map((item) => item.x),
    [0, document.tileWidth],
  );
  assert.deepEqual(
    document.frames.map((item) => item.y),
    [0, 0],
  );
});

test("guide line sits under the contact row when the canvas has room", () => {
  assert.equal(guideRow(8, 11), 9);
  assert.equal(guideRow(10, 11), 10);
  assert.equal(guideRow(0, 1), 0);
});

test("file names sort in frame order", () => {
  const names = ["Walk_10.png", "Walk_2.png", "walk_01.png"];
  const sorted = names.slice().sort(compareFileNames);
  assert.deepEqual(sorted, ["walk_01.png", "Walk_2.png", "Walk_10.png"]);
});

test("blit keeps the source foot on the requested row", () => {
  const source = blank(6, 6);
  fill(source, 6, 4, 3, 5, 5, 255);
  const placed = blitPixels(source, 6, 6, -3, -2, 8, 8);
  const bounds = findOpaqueBounds(placed, 8, 8, 30);
  assert.deepEqual(bounds, { x: 1, y: 1, width: 2, height: 3 });
});
