import { pixelLabSourceRect, pixelLabTileIndex, wangSourceRect } from "./ruleTile.ts";

export type SandboxLayout =
  | { kind: "fifteen" }
  | { kind: "wang"; doubled: boolean };

export const FIFTEEN_LAYOUT: SandboxLayout = { kind: "fifteen" };

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
 * Cells whose 4-bit mask changes when `(x, y)` is painted or erased:
 * the edited cell and its cardinal neighbors.
 */
export function cellsTouchedByEdit(
  x: number,
  y: number,
  size = SANDBOX_SIZE,
): { x: number; y: number }[] {
  const coords = [{ x, y }];
  if (y > 0) coords.push({ x, y: y - 1 });
  if (x + 1 < size) coords.push({ x: x + 1, y });
  if (y + 1 < size) coords.push({ x, y: y + 1 });
  if (x > 0) coords.push({ x: x - 1, y });
  return coords;
}

function sheetIndexForMask(mask: number, layout: SandboxLayout): number {
  return layout.kind === "wang" ? wangSourceRect(mask, 1, layout.doubled).index : pixelLabTileIndex(mask);
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
  return sheetIndexForMask(cardinalMaskAt(cells, x, y, size), layout);
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
  const mask = cardinalMaskAt(cells, x, y, size);
  const source = layout.kind === "wang"
    ? wangSourceRect(mask, tileSize, layout.doubled)
    : pixelLabSourceRect(mask, tileSize);
  return { ...source, mask };
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
