import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIFTEEN_INDEX,
  WANG_5X8_BORDER,
  WANG_5X8_INDEX,
  WANG_TALL_FLOOR_INDEX,
  godotCellForMask,
  godotSourceRect,
  isFifteenPillar,
  isWang5x8Black,
} from "./ruleTile.ts";
import {
  CARDINAL,
  cardinalMaskAt,
  cellsTouchedByEdit,
  emptySandbox,
  paintCell,
  sandboxPillarOverlayIndex,
  sandboxPillarOverlayRect,
  sandboxSourceRect,
  sandboxTileIndex,
} from "./tileSandbox.ts";

test("a 3x5 rectangle uses the bright floor and never a pillar", () => {
  const block = fillRect(emptySandbox(), 2, 2, 5, 4);
  const at = (x: number, y: number) => sandboxTileIndex(block, x, y);
  assert.equal(at(3, 3), FIFTEEN_INDEX.floor);
  assert.equal(at(4, 3), FIFTEEN_INDEX.floor);
  assert.equal(at(3, 2), FIFTEEN_INDEX.north);
  assert.equal(at(3, 4), FIFTEEN_INDEX.south);
  assert.equal(at(2, 3), FIFTEEN_INDEX.west);
  assert.equal(at(5, 3), FIFTEEN_INDEX.east);
  assert.equal(at(2, 2), FIFTEEN_INDEX.outerNW);
  assert.equal(at(5, 2), FIFTEEN_INDEX.outerNE);
  assert.equal(at(2, 4), FIFTEEN_INDEX.outerSW);
  assert.equal(at(5, 4), FIFTEEN_INDEX.outerSE);
  assert.equal(at(3, 3), 7);
  assert.equal(at(5, 3), 8);
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 5; x += 1) {
      const index = at(x, y);
      assert.equal(index === null || index <= 14, true);
      assert.equal(index === 15, false);
      if (index !== null) assert.equal(isFifteenPillar(index), false);
    }
  }
  const alone = sandboxTileIndex(fillRect(emptySandbox(), 1, 1, 1, 1), 1, 1);
  assert.equal(alone, 7);
  const rect = sandboxSourceRect(block, 3, 3, 32);
  assert.deepEqual(
    rect && { index: rect.index, x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    { index: 7, x: 32, y: 64, width: 32, height: 32 },
  );
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
  assert.equal(sandboxTileIndex(cells, 3, 3), FIFTEEN_INDEX.floor);
  assert.equal(sandboxTileIndex(cells, 3, 2), FIFTEEN_INDEX.floor);
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

test("a 5x8 Wang rectangle fills tile_16 and keeps the fixed border", () => {
  const layout = { kind: "wang" as const, tall: true };
  const border = new Set<number>(WANG_5X8_BORDER);
  let cells = fillRect(emptySandbox(), 2, 2, 5, 4);

  const at = (x: number, y: number) => sandboxSourceRect(cells, x, y, 32, 8, layout);
  const interior = at(3, 3);
  assert.ok(interior);
  assert.equal(interior.index, WANG_TALL_FLOOR_INDEX);
  assert.equal(interior.index, WANG_5X8_INDEX.floor);
  assert.equal(interior.mask, 15);
  assert.deepEqual(
    { x: interior.x, y: interior.y, width: interior.width, height: interior.height },
    { x: 32, y: 96, width: 32, height: 32 },
  );
  assert.equal(at(4, 3)?.index, 16);
  assert.equal(at(3, 2)?.index, WANG_5X8_INDEX.north);
  assert.equal(at(4, 2)?.index, WANG_5X8_INDEX.north);
  assert.equal(at(3, 4)?.index, WANG_5X8_INDEX.south);
  assert.equal(at(4, 4)?.index, WANG_5X8_INDEX.south);
  assert.equal(at(2, 3)?.index, WANG_5X8_INDEX.west);
  assert.equal(at(5, 3)?.index, WANG_5X8_INDEX.east);
  assert.equal(at(2, 2)?.index, WANG_5X8_INDEX.outerNW);
  assert.equal(at(5, 2)?.index, WANG_5X8_INDEX.outerNE);
  assert.equal(at(2, 4)?.index, WANG_5X8_INDEX.outerSW);
  assert.equal(at(5, 4)?.index, WANG_5X8_INDEX.outerSE);

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 5; x += 1) {
      const sample = at(x, y);
      assert.ok(sample);
      assert.equal(isWang5x8Black(sample.index), false);
      const surrounded = x > 2 && x < 5 && y > 2 && y < 4;
      if (surrounded) {
        assert.equal(sample.index, 16);
        assert.equal(sample.index === 0 || sample.index === 1 || sample.index === 2, false);
      } else {
        assert.equal(border.has(sample.index), true);
      }
    }
  }

  const block = cells;
  cells = paintCell(cells, 4, 2, 0);
  assert.equal(sandboxTileIndex(cells, 3, 3, 8, layout), WANG_5X8_INDEX.innerNE);
  assert.equal(sandboxTileIndex(cells, 4, 3, 8, layout), WANG_5X8_INDEX.north);
  assert.equal(sandboxPillarOverlayIndex(cells, 4, 2, 8, layout), 6);
  assert.equal(sandboxPillarOverlayIndex(block, 4, 2, 8, layout), null);

  const alone = sandboxSourceRect(fillRect(emptySandbox(), 1, 1, 1, 1), 1, 1, 32, 8, layout);
  assert.ok(alone);
  assert.equal(alone.index, WANG_5X8_INDEX.single);
  assert.equal(alone.index, 13);
  assert.equal(alone.width, 32);
  assert.equal(alone.height, 32);
  assert.notEqual(alone.index, 0);
  assert.notEqual(alone.index, 16);

  assert.equal(sandboxPillarOverlayIndex(block, 2, 1, 8, layout), 5);
  assert.equal(sandboxPillarOverlayIndex(block, 3, 1, 8, layout), 6);
  assert.equal(sandboxPillarOverlayIndex(block, 4, 1, 8, layout), 6);
  assert.equal(sandboxPillarOverlayIndex(block, 5, 1, 8, layout), 7);
  assert.equal(sandboxPillarOverlayIndex(block, 3, 2, 8, layout), null);
  assert.equal(sandboxPillarOverlayIndex(block, 3, 0, 8, layout), null);
  const pillar = sandboxPillarOverlayRect(block, 3, 1, 32, 8, layout);
  assert.deepEqual(pillar, { index: 6, x: 32, y: 32, width: 32, height: 32 });
  const leftPillar = sandboxPillarOverlayRect(block, 2, 1, 32, 8, layout);
  assert.deepEqual(leftPillar, { index: 5, x: 0, y: 32, width: 32, height: 32 });
  const rightPillar = sandboxPillarOverlayRect(block, 5, 1, 32, 8, layout);
  assert.deepEqual(rightPillar, { index: 7, x: 64, y: 32, width: 32, height: 32 });

  const column = fillRect(emptySandbox(), 3, 2, 3, 4);
  assert.equal(sandboxTileIndex(column, 3, 2, 8, layout), 3);
  assert.equal(sandboxTileIndex(column, 3, 3, 8, layout), 8);
  assert.equal(sandboxTileIndex(column, 3, 4, 8, layout), 13);
  assert.equal(sandboxPillarOverlayIndex(column, 3, 1, 8, layout), null);
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

test("fill mode swaps the Wang and Godot sandbox sprites", () => {
  const floorWang = { kind: "wang" as const, tall: true, fillMode: "floor" as const };
  const wallWang = { kind: "wang" as const, tall: true, fillMode: "wall" as const };
  const block = fillRect(emptySandbox(), 2, 2, 5, 4);
  assert.equal(sandboxTileIndex(block, 3, 3, 8, floorWang), 16);
  assert.equal(sandboxTileIndex(block, 3, 3, 8, wallWang), 26);
  assert.equal(sandboxTileIndex(block, 3, 2, 8, wallWang), 21);
  assert.equal(sandboxTileIndex(block, 3, 4, 8, wallWang), 11);
  assert.equal(sandboxTileIndex(block, 2, 3, 8, wallWang), 17);
  assert.equal(sandboxTileIndex(block, 5, 3, 8, wallWang), 15);
  assert.equal(sandboxTileIndex(block, 2, 2, 8, wallWang), 24);
  assert.equal(sandboxTileIndex(block, 5, 2, 8, wallWang), 23);
  assert.equal(sandboxTileIndex(block, 2, 4, 8, wallWang), 29);
  assert.equal(sandboxTileIndex(block, 5, 4, 8, wallWang), 28);
  assert.equal(sandboxPillarOverlayIndex(block, 3, 1, 8, floorWang), 6);
  assert.equal(sandboxPillarOverlayIndex(block, 3, 1, 8, wallWang), null);

  const column = fillRect(emptySandbox(), 3, 2, 3, 4);
  assert.equal(sandboxTileIndex(column, 3, 2, 8, wallWang), 6);
  assert.equal(sandboxTileIndex(column, 3, 3, 8, wallWang), 6);
  assert.equal(sandboxTileIndex(column, 3, 4, 8, wallWang), 6);

  const floorGodot = { kind: "godot" as const, tall: true, fillMode: "floor" as const };
  const wallGodot = { kind: "godot" as const, tall: true, fillMode: "wall" as const };
  const room = fillRect(emptySandbox(), 2, 2, 4, 4);
  assert.equal(sandboxTileIndex(room, 3, 3, 8, floorGodot), 34);
  assert.equal(sandboxTileIndex(room, 2, 2, 8, floorGodot), 21);
  assert.equal(sandboxTileIndex(room, 3, 2, 8, floorGodot), 22);
  assert.equal(sandboxTileIndex(room, 4, 2, 8, floorGodot), 23);
  assert.equal(sandboxTileIndex(room, 2, 4, 8, floorGodot), 57);
  assert.equal(sandboxTileIndex(room, 3, 4, 8, floorGodot), 58);
  assert.equal(sandboxTileIndex(room, 4, 4, 8, floorGodot), 59);
  assert.equal(sandboxTileIndex(room, 2, 3, 8, floorGodot), 33);
  assert.equal(sandboxTileIndex(room, 4, 3, 8, floorGodot), 47);
  assert.notEqual(sandboxTileIndex(room, 4, 3, 8, floorGodot), 27);
  assert.notEqual(sandboxTileIndex(room, 4, 3, 8, floorGodot), 35);
  assert.equal(sandboxPillarOverlayIndex(room, 2, 1, 8, floorGodot), 85);
  assert.equal(sandboxPillarOverlayIndex(room, 3, 1, 8, floorGodot), 86);
  assert.equal(sandboxPillarOverlayIndex(room, 4, 1, 8, floorGodot), 87);
  assert.equal(sandboxPillarOverlayIndex(room, 3, 2, 8, floorGodot), null);
  const cap = sandboxPillarOverlayRect(room, 3, 1, 32, 8, floorGodot);
  assert.deepEqual(cap, { index: 86, x: 2 * 32, y: 7 * 32, width: 32, height: 32 });
  const notch = paintCell(fillRect(emptySandbox(), 0, 0, 2, 2), 0, 0, 0);
  assert.equal(sandboxTileIndex(notch, 1, 1, 8, floorGodot), 44);

  const hall = fillRect(emptySandbox(), 1, 3, 3, 3);
  assert.equal(sandboxTileIndex(hall, 1, 3, 8, floorGodot), 1);
  assert.equal(sandboxTileIndex(hall, 2, 3, 8, floorGodot), 2);
  assert.equal(sandboxTileIndex(hall, 3, 3, 8, floorGodot), 3);
  const shaft = fillRect(emptySandbox(), 4, 1, 4, 3);
  assert.equal(sandboxTileIndex(shaft, 4, 1, 8, floorGodot), 12);
  assert.equal(sandboxTileIndex(shaft, 4, 2, 8, floorGodot), 24);
  assert.equal(sandboxTileIndex(shaft, 4, 3, 8, floorGodot), 48);

  assert.equal(sandboxTileIndex(room, 3, 3, 8, wallGodot), 41);
  assert.equal(sandboxTileIndex(room, 2, 2, 8, wallGodot), 20);
  assert.equal(sandboxTileIndex(room, 4, 2, 8, wallGodot), 23);
  assert.equal(sandboxTileIndex(room, 3, 2, 8, wallGodot), 50);
  assert.equal(sandboxTileIndex(room, 2, 3, 8, wallGodot), 35);
  assert.equal(sandboxTileIndex(room, 4, 3, 8, wallGodot), 32);
  assert.equal(sandboxTileIndex(room, 2, 4, 8, wallGodot), 56);
  assert.equal(sandboxTileIndex(room, 3, 4, 8, wallGodot), 74);
  assert.equal(sandboxTileIndex(room, 4, 4, 8, wallGodot), 59);
  assert.equal(sandboxPillarOverlayIndex(room, 2, 5, 8, wallGodot), 61);
  assert.equal(sandboxPillarOverlayIndex(room, 3, 5, 8, wallGodot), 62);
  assert.equal(sandboxPillarOverlayIndex(room, 4, 5, 8, wallGodot), 63);
  assert.equal(sandboxPillarOverlayIndex(room, 3, 1, 8, wallGodot), null);

  const pillar = fillRect(emptySandbox(), 6, 2, 6, 4);
  assert.equal(sandboxTileIndex(pillar, 6, 2, 8, wallGodot), 15);
  assert.equal(sandboxTileIndex(pillar, 6, 3, 8, wallGodot), 27);
  assert.equal(sandboxTileIndex(pillar, 6, 4, 8, wallGodot), 63);
  const lone = fillRect(emptySandbox(), 0, 0, 0, 0);
  assert.equal(sandboxTileIndex(lone, 0, 0, 8, floorGodot), 72);
  assert.equal(sandboxTileIndex(lone, 0, 0, 8, wallGodot), 63);
});
