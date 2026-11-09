import assert from "node:assert/strict";
import { test } from "node:test";
import { FIFTEEN_TILE_MASKS, godotCellForMask, pixelLabTileIndex, wangIndexForMask } from "./ruleTile.ts";
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

test("painting a cell refreshes that cell and its four neighbors", () => {
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
  ]);

  const erased = paintCell(cells, 3, 2, 0);
  assert.equal(cardinalMaskAt(erased, 3, 3) & CARDINAL.Up, 0);
  assert.equal(sandboxTileIndex(erased, 3, 2), null);
});

test("a 5x8 Wang sheet crops the full logical tile instead of the mask number", () => {
  let cells = emptySandbox();
  cells = paintCell(cells, 1, 1, 1);
  const layout = { kind: "wang" as const, doubled: true };
  const alone = sandboxSourceRect(cells, 1, 1, 32, 8, layout);
  assert.ok(alone);
  assert.equal(alone.mask, 0);
  assert.equal(alone.index, wangIndexForMask(0, true));
  assert.equal(alone.width, 32);
  assert.equal(alone.height, 64);
  assert.equal(sandboxTileIndex(cells, 1, 1, 8, layout), wangIndexForMask(0, true));

  cells = paintCell(cells, 1, 0, 1);
  cells = paintCell(cells, 2, 1, 1);
  cells = paintCell(cells, 1, 2, 1);
  cells = paintCell(cells, 0, 1, 1);
  const full = sandboxSourceRect(cells, 1, 1, 32, 8, layout);
  assert.ok(full);
  assert.equal(full.mask, 15);
  assert.deepEqual(
    { x: full.x, y: full.y, width: full.width, height: full.height },
    { x: 32, y: 64, width: 32, height: 64 },
  );
  assert.notEqual(full.index, full.mask);
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
});
