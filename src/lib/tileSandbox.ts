import {
  FIFTEEN_4X8_OVERLAYS,
  fifteenFixedResolve,
  fifteenRectForIndex,
  godotFixedResolve,
  godotRectForIndex,
  godotSourceRect,
  terrainOverlays,
  wangRectForIndex,
  wangResolve,
  type FillMode,
  type FifteenShape,
  type Neighbors,
} from "./ruleTile.ts";

export type SandboxLayout =
  | { kind: "fifteen"; shape: FifteenShape }
  | { kind: "wang"; tall: boolean; fillMode?: FillMode }
  | { kind: "godot"; tall?: boolean; fillMode?: FillMode };

export const FIFTEEN_LAYOUT: SandboxLayout = { kind: "fifteen", shape: "3x5" };

export const SANDBOX_SIZE = 8;
export const SANDBOX_CELL_PX = 32;

/** Cardinal neighbor bits. Up=1, Right=2, Down=4, Left=8. */
export const CARDINAL = {
  Up: 1,
  Right: 2,
  Down: 4,
  Left: 8,
} as const;

export function emptySandbox(size = SANDBOX_SIZE): number[] {
  return new Array(size * size).fill(0);
}

export function cardinalMaskAt(
  cells: readonly number[],
  x: number,
  y: number,
  size = SANDBOX_SIZE,
): number {
  if (x < 0 || y < 0 || x >= size || y >= size) return 0;
  const index = y * size + x;
  if (cells[index] !== 1) return 0;
  let mask = 0;
  if (y > 0 && cells[index - size] === 1) mask |= CARDINAL.Up;
  if (x + 1 < size && cells[index + 1] === 1) mask |= CARDINAL.Right;
  if (y + 1 < size && cells[index + size] === 1) mask |= CARDINAL.Down;
  if (x > 0 && cells[index - 1] === 1) mask |= CARDINAL.Left;
  return mask;
}

/**
 * Cells whose tile can change when `(x, y)` is painted or erased.
 * Wang corners and Godot blobs read all eight neighbours, so the ring is included.
 */
export function cellsTouchedByEdit(
  x: number,
  y: number,
  size = SANDBOX_SIZE,
): { x: number; y: number }[] {
  const coords = [{ x, y }];
  const deltas = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const;
  for (const [dx, dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < size && ny < size) coords.push({ x: nx, y: ny });
  }
  return coords;
}

/** This/NotThis around a painted cell. Outside the grid is NotThis. Up2/Up3/Down2 feed the Godot wall stack. */
export function cellNeighbors(
  cells: readonly number[],
  x: number,
  y: number,
  size = SANDBOX_SIZE,
): Neighbors {
  const at = (dx: number, dy: number): 1 | 2 => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) return 2;
    return cells[ny * size + nx] === 1 ? 1 : 2;
  };
  return {
    Top: at(0, -1),
    Bottom: at(0, 1),
    Left: at(-1, 0),
    Right: at(1, 0),
    TopLeft: at(-1, -1),
    TopRight: at(1, -1),
    BottomLeft: at(-1, 1),
    BottomRight: at(1, 1),
    Up2: at(0, -2),
    Up3: at(0, -3),
    Down2: at(0, 2),
  };
}

function layoutFillMode(layout: SandboxLayout): FillMode {
  if (layout.kind === "fifteen") return "floor";
  return layout.fillMode === "wall" ? "wall" : "floor";
}

function layoutTall(layout: SandboxLayout): boolean {
  if (layout.kind === "wang") return layout.tall;
  if (layout.kind === "godot") return layout.tall === true;
  return false;
}

function sheetIndexForMask(mask: number): number {
  return godotSourceRect(mask, 1).index;
}

/**
 * Pillar sprite drawn on an empty neighbour of a border tile.
 * Floor mode draws the cap above the north lip. Godot wall mode draws the
 * foot under the south lip. The painted cell keeps its own terrain sprite.
 */
export function sandboxPillarOverlayIndex(
  cells: readonly number[],
  x: number,
  y: number,
  size = SANDBOX_SIZE,
  layout: SandboxLayout = FIFTEEN_LAYOUT,
): number | null {
  if (layout.kind === "fifteen" && layout.shape !== "4x8") return null;
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  if (cells[y * size + x] === 1) return null;
  const overlays = layout.kind === "fifteen"
    ? FIFTEEN_4X8_OVERLAYS
    : terrainOverlays(
      layout.kind,
      layoutFillMode(layout),
      layoutTall(layout),
    );
  for (const overlay of overlays) {
    const sourceY = y - overlay.dy;
    if (sourceY < 0 || sourceY >= size) continue;
    const source = sandboxTileIndex(cells, x, sourceY, size, layout);
    if (source === overlay.source) return overlay.tile;
  }
  return null;
}

export function sandboxPillarOverlayRect(
  cells: readonly number[],
  x: number,
  y: number,
  tileSize: number,
  size = SANDBOX_SIZE,
  layout: SandboxLayout = FIFTEEN_LAYOUT,
) {
  const index = sandboxPillarOverlayIndex(cells, x, y, size, layout);
  if (index === null) return null;
  if (layout.kind === "fifteen") return fifteenRectForIndex(index, tileSize, "4x8");
  if (layout.kind === "godot" && layout.tall) return godotRectForIndex(index, tileSize);
  return wangRectForIndex(index, tileSize);
}

/** Filled cells map 1:1 onto the active PixelLab sheet. Empty cells draw nothing. */
export function sandboxTileIndex(
  cells: readonly number[],
  x: number,
  y: number,
  size = SANDBOX_SIZE,
  layout: SandboxLayout = FIFTEEN_LAYOUT,
): number | null {
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  if (cells[y * size + x] !== 1) return null;
  if (layout.kind === "wang") {
    return wangResolve(cellNeighbors(cells, x, y, size), layout.tall, layoutFillMode(layout)).index;
  }
  if (layout.kind === "fifteen") {
    return fifteenFixedResolve(cellNeighbors(cells, x, y, size), layout.shape).index;
  }
  if (layout.kind === "godot" && layout.tall) {
    return godotFixedResolve(cellNeighbors(cells, x, y, size), layoutFillMode(layout)).index;
  }
  return sheetIndexForMask(blobMaskAt(cells, x, y, size));
}

export function sandboxSourceRect(
  cells: readonly number[],
  x: number,
  y: number,
  tileSize: number,
  size = SANDBOX_SIZE,
  layout: SandboxLayout = FIFTEEN_LAYOUT,
) {
  const index = sandboxTileIndex(cells, x, y, size, layout);
  if (index === null) return null;
  if (layout.kind === "wang") {
    const resolved = wangResolve(cellNeighbors(cells, x, y, size), layout.tall, layoutFillMode(layout));
    return { ...wangRectForIndex(resolved.index, tileSize), mask: resolved.mask };
  }
  if (layout.kind === "fifteen") {
    const resolved = fifteenFixedResolve(cellNeighbors(cells, x, y, size), layout.shape);
    return { ...fifteenRectForIndex(resolved.index, tileSize, layout.shape), mask: resolved.mask };
  }
  if (layout.kind === "godot" && layout.tall) {
    const resolved = godotFixedResolve(cellNeighbors(cells, x, y, size), layoutFillMode(layout));
    return { ...godotRectForIndex(resolved.index, tileSize), mask: resolved.mask };
  }
  const mask = blobMaskAt(cells, x, y, size);
  const source = godotSourceRect(mask, tileSize);
  return { ...source, mask };
}

/** 8-direction blob bits. N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128. */
export function blobMaskAt(
  cells: readonly number[],
  x: number,
  y: number,
  size = SANDBOX_SIZE,
): number {
  if (x < 0 || y < 0 || x >= size || y >= size) return 0;
  if (cells[y * size + x] !== 1) return 0;
  const filled = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < size && ny < size && cells[ny * size + nx] === 1;
  };
  let mask = 0;
  if (filled(0, -1)) mask |= 1;
  if (filled(1, -1)) mask |= 2;
  if (filled(1, 0)) mask |= 4;
  if (filled(1, 1)) mask |= 8;
  if (filled(0, 1)) mask |= 16;
  if (filled(-1, 1)) mask |= 32;
  if (filled(-1, 0)) mask |= 64;
  if (filled(-1, -1)) mask |= 128;
  return mask;
}

export function paintCell(
  cells: readonly number[],
  x: number,
  y: number,
  value: 0 | 1,
  size = SANDBOX_SIZE,
): number[] {
  if (x < 0 || y < 0 || x >= size || y >= size) return cells.slice();
  const index = y * size + x;
  if ((cells[index] === 1 ? 1 : 0) === value) return cells.slice();
  const next = cells.slice();
  next[index] = value;
  return next;
}
