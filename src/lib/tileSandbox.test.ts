import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIFTEEN_TILE_MASKS,
  WANG_TALL_FLOOR_INDEX,
  godotCellForMask,
  godotSourceRect,
  pixelLabTileIndex,
  wangSurfaceIndex,
} from "./ruleTile.ts";
import {
  CARDINAL,
  cardinalMaskAt,
  cellsTouchedByEdit,
  emptySandbox,
  paintCell,
  sandboxSourceRect,
  sandboxTileIndex,
} from "./tileSandbox.ts";

test("every cardinal mask maps onto the 3x5 PixelLab sheet", () => {
  const seen = new Set<number>();
  for (let mask = 1; mask < 16; mask += 1) {
    const index = pixelLabTileIndex(mask);
    assert.equal(FIFTEEN_TILE_MASKS[index], mask);
    seen.add(index);
  }
  assert.equal(seen.size, 15);
  assert.equal(pixelLabTileIndex(0), pixelLabTileIndex(15));
  assert.equal(pixelLabTileIndex(15), 6);
  assert.equal(pixelLabTileIndex(0, "4x4"), 12);
  assert.equal(pixelLabTileIndex(15, "4x4"), 6);
});

test("painting a cell refreshes that cell and its eight neighbors", () => {
  let cells = emptySandbox();
  cells = paintCell(cells, 3, 3, 1);
  cells = paintCell(cells, 3, 2, 1);
  cells = paintCell(cells, 4, 3, 1);
  cells = paintCell(cells, 3, 4, 1);
  cells = paintCell(cells, 2, 3, 1);

  assert.equal(cardinalMaskAt(cells, 3, 3), CARDINAL.Up | CARDINAL.Right | CARDINAL.Down | CARDINAL.Left);
  assert.equal(cardinalMaskAt(cells, 3, 2), CARDINAL.Down);
  assert.equal(cardinalMaskAt(cells, 4, 3), CARDINAL.Left);
  assert.equal(cardinalMaskAt(cells, 0, 0), 0);
  assert.equal(sandboxTileIndex(cells, 3, 3), pixelLabTileIndex(15));
  assert.equal(sandboxTileIndex(cells, 3, 2), pixelLabTileIndex(CARDINAL.Down));
  assert.equal(sandboxTileIndex(cells, 1, 1), null);

  const touched = cellsTouchedByEdit(3, 3);
  assert.deepEqual(touched, [
    { x: 3, y: 3 },
    { x: 3, y: 2 },
    { x: 4, y: 3 },
    { x: 3, y: 4 },
    { x: 2, y: 3 },
    { x: 4, y: 2 },
    { x: 4, y: 4 },
    { x: 2, y: 4 },
    { x: 2, y: 2 },
  ]);

  const erased = paintCell(cells, 3, 2, 0);
  assert.equal(cardinalMaskAt(erased, 3, 3) & CARDINAL.Up, 0);
  assert.equal(sandboxTileIndex(erased, 3, 2), null);
});

function fillRect(cells: number[], x0: number, y0: number, x1: number, y1: number): number[] {
  let next = cells;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) next = paintCell(next, x, y, 1);
  }
  return next;
}

test("a 5x8 Wang rectangle paints the flat floor and leaves the pillar wall unused", () => {
  const layout = { kind: "wang" as const, tall: true };
  let cells = fillRect(emptySandbox(), 2, 2, 5, 4);

  const at = (x: number, y: number) => sandboxSourceRect(cells, x, y, 32, 8, layout);
  const interior = at(3, 3);
  assert.ok(interior);
  assert.equal(interior.index, WANG_TALL_FLOOR_INDEX);
  assert.equal(interior.mask, 15);
  assert.deepEqual(
    { x: interior.x, y: interior.y, width: interior.width, height: interior.height },
    { x: 0, y: 192, width: 32, height: 32 },
  );
  assert.equal(at(4, 3)?.index, WANG_TALL_FLOOR_INDEX);
  assert.equal(at(3, 2)?.index, wangSurfaceIndex(12, true));
  assert.equal(at(3, 4)?.index, wangSurfaceIndex(3, true));
  assert.equal(at(2, 3)?.index, wangSurfaceIndex(10, true));
  assert.equal(at(5, 3)?.index, wangSurfaceIndex(5, true));
  assert.equal(at(2, 2)?.index, wangSurfaceIndex(8, true));
  assert.equal(at(5, 2)?.index, wangSurfaceIndex(4, true));
  assert.equal(at(2, 4)?.index, wangSurfaceIndex(2, true));
  assert.equal(at(5, 4)?.index, wangSurfaceIndex(1, true));
  assert.notEqual(at(3, 3)?.index, 15);
  assert.notEqual(at(3, 3)?.index, 25);
  assert.notEqual(at(3, 3)?.index, 0);

  cells = paintCell(cells, 4, 2, 0);
  assert.equal(sandboxTileIndex(cells, 3, 3, 8, layout), wangSurfaceIndex(13, true));

  const alone = sandboxSourceRect(fillRect(emptySandbox(), 1, 1, 1, 1), 1, 1, 32, 8, layout);
  assert.ok(alone);
  assert.equal(alone.index, WANG_TALL_FLOOR_INDEX);
  assert.equal(alone.mask, 15);
  assert.equal(alone.width, 32);
  assert.equal(alone.height, 32);
  assert.notEqual(alone.index, 0);
});

test("a Godot sandbox cell samples the 47-blob template", () => {
  let cells = emptySandbox();
  cells = paintCell(cells, 2, 2, 1);
  const layout = { kind: "godot" as const };
  const alone = sandboxSourceRect(cells, 2, 2, 32, 8, layout);
  assert.ok(alone);
  assert.equal(alone.mask, 0);
  assert.equal(alone.index, godotCellForMask(0).index);
  assert.equal(sandboxTileIndex(cells, 2, 2, 8, layout), alone.index);

  cells = paintCell(cells, 3, 2, 1);
  cells = paintCell(cells, 2, 3, 1);
  cells = paintCell(cells, 3, 3, 1);
  const corner = sandboxSourceRect(cells, 2, 2, 32, 8, layout);
  assert.ok(corner);
  const mask = 4 | 8 | 16;
  assert.equal(corner.mask, mask);
  assert.equal(corner.index, godotCellForMask(mask).index);
  assert.equal(sandboxTileIndex(cells, 2, 2, 8, layout), corner.index);
  assert.deepEqual(
    { x: corner.x, y: corner.y, width: corner.width, height: corner.height },
    { x: (corner.index % 12) * 32, y: Math.floor(corner.index / 12) * 32, width: 32, height: 32 },
  );

  const block = fillRect(emptySandbox(), 2, 2, 4, 4);
  const center = sandboxSourceRect(block, 3, 3, 32, 8, layout);
  assert.ok(center);
  assert.equal(center.mask, 255);
  assert.deepEqual(
    { index: center.index, x: center.x, y: center.y, width: center.width, height: center.height },
    godotSourceRect(255, 32),
  );
  assert.equal(center.index, 33);
  assert.equal(center.x, 288);
  assert.equal(center.y, 64);

  const outer = sandboxSourceRect(block, 2, 2, 32, 8, layout);
  assert.ok(outer);
  const outerMask = 4 | 8 | 16;
  assert.equal(outer.mask, outerMask);
  assert.deepEqual(
    { index: outer.index, x: outer.x, y: outer.y, width: outer.width, height: outer.height },
    godotSourceRect(outerMask, 32),
  );
  assert.equal(outer.index, godotCellForMask(outerMask).index);
  assert.equal(outer.x, 8 * 32);
  assert.equal(outer.y, 0);
});
