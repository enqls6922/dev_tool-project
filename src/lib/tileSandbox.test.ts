import assert from "node:assert/strict";
import { test } from "node:test";
import { FIFTEEN_TILE_MASKS, pixelLabTileIndex } from "./ruleTile.ts";
import {
  CARDINAL,
  cardinalMaskAt,
  cellsTouchedByEdit,
  emptySandbox,
  paintCell,
  sandboxTileIndex,
} from "./tileSandbox.ts";

test("every cardinal mask maps to exactly one PixelLab 15-tileset index", () => {
  const seen = new Set<number>();
  for (let mask = 0; mask < 16; mask += 1) {
    const index = pixelLabTileIndex(mask);
    assert.equal(FIFTEEN_TILE_MASKS[index], mask);
    seen.add(index);
  }
  assert.equal(seen.size, 16);
  assert.equal(pixelLabTileIndex(0), 12);
  assert.equal(pixelLabTileIndex(15), 6);
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
