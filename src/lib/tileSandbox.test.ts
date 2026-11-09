import assert from "node:assert/strict";
import { test } from "node:test";
import { FIFTEEN_TILE_MASKS, godotCellForMask, pixelLabTileIndex, wangEdgeIndex } from "./ruleTile.ts";
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

test("a 5x8 Wang rectangle fills the floor and keeps square border tiles", () => {
  const layout = { kind: "wang" as const, edgeBand: true };
  let cells = fillRect(emptySandbox(), 2, 2, 5, 4);

  const at = (x: number, y: number) => sandboxSourceRect(cells, x, y, 32, 8, layout);
  const interior = at(3, 3);
  assert.ok(interior);
  assert.equal(interior.index, 15);
  assert.equal(interior.mask, 15);
  assert.deepEqual(
    { x: interior.x, y: interior.y, width: interior.width, height: interior.height },
    { x: 0, y: 96, width: 32, height: 32 },
  );
  assert.equal(at(4, 3)?.index, 15);
  assert.equal(at(3, 2)?.index, 12);
  assert.equal(at(3, 4)?.index, 3);
  assert.equal(at(2, 3)?.index, 10);
  assert.equal(at(5, 3)?.index, 5);
  assert.equal(at(2, 2)?.index, 8);
  assert.equal(at(5, 2)?.index, 4);
  assert.equal(at(2, 4)?.index, 2);
  assert.equal(at(5, 4)?.index, 1);
  assert.notEqual(at(3, 3)?.index, 11);

  cells = paintCell(cells, 4, 2, 0);
  assert.equal(sandboxTileIndex(cells, 3, 3, 8, layout), 13);

  const alone = sandboxSourceRect(fillRect(emptySandbox(), 1, 1, 1, 1), 1, 1, 32, 8, layout);
  assert.ok(alone);
  assert.equal(alone.index, 0);
  assert.equal(alone.width, 32);
  assert.equal(alone.height, 32);

  let corridor = emptySandbox();
  corridor = paintCell(corridor, 2, 3, 1);
  corridor = paintCell(corridor, 3, 3, 1);
  corridor = paintCell(corridor, 4, 3, 1);
  assert.equal(sandboxTileIndex(corridor, 3, 3, 8, layout), wangEdgeIndex(2 | 8));
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
