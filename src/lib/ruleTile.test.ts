import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOB,
  DIRECTION_KEYS,
  FIFTEEN_TILE_MASKS,
  NATIVE_16_MASKS,
  actualFromCornerMask,
  analyzeSheet,
  buildRuleTileScript,
  canonicalBlobMask,
  countCondition,
  detectPreset,
  firstMatchingRule,
  godotCellForMask,
  neighborsFromCornerMask,
  ruleMatches,
  suggestPreset,
  tileSpriteName,
  unitySliceRect,
  GODOT_BLOB_GRID,
  WANG_5X8_BLACK,
  WANG_5X8_BORDER,
  WANG_5X8_INDEX,
  WANG_TALL_FLOOR_INDEX,
  isWang5x8Black,
  wangCellMask,
  wangIndexForMask,
  wangIsWallHalf,
  wangMatchingIndex,
  wangResolve,
  wangSourceRect,
  type Neighbors,
} from "./ruleTile.ts";

test("the 15-tile template packs masks 1-15 into 3 columns", () => {
  assert.equal(FIFTEEN_TILE_MASKS.length, 15);
  assert.equal(new Set(FIFTEEN_TILE_MASKS).size, 15);
  assert.equal(FIFTEEN_TILE_MASKS.includes(0), false);
  assert.deepEqual([...FIFTEEN_TILE_MASKS].sort((a, b) => a - b), [...Array(15).keys()].map((n) => n + 1));
  assert.equal(FIFTEEN_TILE_MASKS[6], 15);
  assert.equal(NATIVE_16_MASKS.length, 16);
  assert.equal(NATIVE_16_MASKS[12], 0);
  assert.equal(NATIVE_16_MASKS[6], 15);
});

test("a filled corner requires the three cells that share it", () => {
  assert.deepEqual(neighborsFromCornerMask(1), {
    Top: 1,
    Bottom: 0,
    Left: 1,
    Right: 0,
    TopLeft: 1,
    TopRight: 0,
    BottomLeft: 0,
    BottomRight: 0,
  });
  assert.equal(countCondition(neighborsFromCornerMask(15), 1), 8);
  assert.equal(countCondition(neighborsFromCornerMask(0), 1), 0);
});

test("PixelLab 15-tileset slices a 3x5 sheet and keeps the floor as the default", () => {
  const analysis = analyzeSheet({ width: 96, height: 160, tileSize: 32, preset: "15-tileset" });
  assert.equal(analysis.error, null);
  const data = analysis.data;
  assert.ok(data);
  assert.equal(data.columns, 3);
  assert.equal(data.rows, 5);
  assert.equal(data.tileSize, 32);
  assert.equal(data.rules.length, 15);
  assert.equal(data.defaultSpriteIndex, 6);
  assert.equal(data.cells[6]?.mask, 15);
  assert.equal(data.cells[6]?.name, "floor");
  assert.equal(data.rules[0]?.index, 6);
  assert.equal(countCondition(data.rules[0].neighbors, 1), 8);
  assert.equal(data.rules.some((rule) => rule.index === data.defaultSpriteIndex), true);
});

test("a native 4x4 15-tileset still emits 15 rules in strictest-first order", () => {
  const analysis = analyzeSheet({ width: 128, height: 128, tileSize: 32, preset: "15-tileset" });
  assert.equal(analysis.error, null);
  const data = analysis.data;
  assert.ok(data);
  assert.equal(data.doubleHeight, false);
  assert.equal(data.rules.length, 15);
  assert.equal(data.rules.some((rule) => countCondition(rule.neighbors, 1) === 0), false);
  assert.equal(data.rules.some((rule) => rule.index === data.defaultSpriteIndex), false);

  let previous = Infinity;
  for (const rule of data.rules) {
    const weight = countCondition(rule.neighbors, 1);
    assert.ok(weight <= previous);
    previous = weight;
    for (const value of Object.values(rule.neighbors)) {
      assert.ok(value === 0 || value === 1 || value === 2);
    }
  }

  const floor = data.rules[0];
  assert.equal(floor.name, "floor");
  assert.equal(countCondition(floor.neighbors, 1), 8);
  const json = JSON.stringify(data);
  assert.match(json, /"Top":1/);
  assert.match(json, /"Bottom":/);
  assert.match(json, /"TopLeft":/);
  assert.match(json, /"BottomRight":/);
});

test("PixelLab Wang 5x8 binds the fixed index table", () => {
  const square = analyzeSheet({ width: 160, height: 128, tileSize: 32, preset: "wang" });
  assert.equal(square.error, null);
  assert.equal(square.warning, null);
  const squareData = square.data;
  assert.ok(squareData);
  assert.equal(squareData.columns, 5);
  assert.equal(squareData.rows, 4);
  assert.equal(squareData.doubleHeight, false);
  assert.equal(squareData.cells.length, 20);
  assert.equal(squareData.rules.length, 15);
  assert.equal(squareData.defaultSpriteIndex, 0);
  assert.equal(squareData.cells[0]?.role, "default");
  assert.equal(squareData.cells[0]?.label, "고립 단독");
  assert.equal(squareData.cells[15]?.role, "rule");
  assert.equal(squareData.cells[15]?.mask, 15);
  assert.equal(squareData.cells[15]?.label, "내부 바닥");
  assert.equal(squareData.cells[16]?.role, "unmapped");
  assert.equal(wangIndexForMask(15, false), 15);
  assert.equal(wangCellMask(15, false), 15);
  assert.equal(wangCellMask(16, false), -1);
  assert.deepEqual(wangSourceRect(15, 32, false), { index: 15, x: 0, y: 96, width: 32, height: 32 });
  assert.throws(() => wangIndexForMask(15, true), /고정 인덱스/);

  const tall = analyzeSheet({ width: 160, height: 256, tileSize: 32, preset: "wang" });
  assert.equal(tall.error, null);
  assert.equal(tall.warning, null);
  const data = tall.data;
  assert.ok(data);
  assert.equal(data.columns, 5);
  assert.equal(data.rows, 8);
  assert.equal(data.doubleHeight, false);
  assert.equal(data.cells.length, 40);
  assert.equal(data.rules.length, 20);
  assert.equal(WANG_TALL_FLOOR_INDEX, 16);
  assert.equal(WANG_5X8_INDEX.floor, 16);
  assert.equal(WANG_5X8_INDEX.defaultSprite, 16);
  assert.equal(data.defaultSpriteIndex, 16);

  const labeled: Record<number, string> = {
    0: "북서 외곽 코너",
    1: "북쪽 상단 벽면",
    2: "북동 외곽 코너",
    6: "고립 단독",
    11: "북서 안쪽 코너",
    12: "북동 안쪽 코너",
    15: "서쪽 좌측 세로벽",
    16: "내부 바닥",
    18: "동쪽 우측 세로벽",
    21: "남서 안쪽 코너",
    22: "남동 안쪽 코너",
    25: "남서 외곽 코너",
    26: "남쪽 하단 바닥경계",
    28: "남동 외곽 코너",
  };
  for (const [indexText, label] of Object.entries(labeled)) {
    const index = Number(indexText);
    assert.equal(data.cells[index]?.label, label);
    assert.equal(data.cells[index]?.role, "rule");
    assert.equal(data.rules.some((rule) => rule.index === index), true);
  }
  assert.equal(data.cells[16]?.fallback, true);
  assert.equal(data.cells[16]?.sprite, "tile_16");
  assert.equal(data.cells[17]?.role, "unmapped");
  assert.equal(data.cells[17]?.label, "미사용");
  assert.equal(data.cells[30]?.role, "unmapped");
  assert.equal(data.cells[30]?.label, "미사용");
  assert.equal(data.rules.some((rule) => rule.index === 17), false);
  assert.equal(data.rules.some((rule) => rule.index === 30), false);
  for (const index of WANG_5X8_BLACK) {
    assert.equal(isWang5x8Black(index), true);
    assert.equal(data.cells[index]?.label, "검은 빈칸");
    assert.equal(data.cells[index]?.role, "unmapped");
    assert.equal(data.rules.some((rule) => rule.index === index), false);
  }
  assert.equal(wangCellMask(16, true), -1);
  assert.equal(wangIsWallHalf(15, true), false);
  assert.equal(wangIsWallHalf(16, true), false);

  let previous = Infinity;
  const seen = new Set<string>();
  for (const rule of data.rules) {
    const weight = countCondition(rule.neighbors, 1) * 10 + countCondition(rule.neighbors, 2);
    assert.ok(weight <= previous);
    previous = weight;
    assert.equal(seen.has(rule.name), false);
    seen.add(rule.name);
    assert.equal(isWang5x8Black(rule.index), false);
    if (rule.index === 0 || rule.index === 1 || rule.index === 2) {
      assert.equal(rule.neighbors.Top, 2);
    }
  }
  assert.equal(data.rules[0]?.name, "floor");
  assert.equal(data.rules[0]?.index, 16);
  assert.equal(countCondition(data.rules[0].neighbors, 1), 8);
  const json = JSON.stringify(data);
  assert.match(json, /"doubleHeight":false/);
  assert.match(json, /"columns":5/);
  assert.match(json, /"rows":8/);
  assert.match(json, /"defaultSpriteIndex":16/);
  assert.match(json, /"name":"floor"/);
  assert.match(json, /"name":"single"/);
  assert.equal(data.rules.some((rule) => isWang5x8Black(rule.index)), false);
});

test("Wang 5x8 neighbourhoods stay on the fixed sprites", () => {
  const wang = analyzeSheet({ width: 160, height: 256, tileSize: 32, preset: "wang" }).data;
  assert.ok(wang);
  const allowed = new Set<number>([
    WANG_5X8_INDEX.floor,
    WANG_5X8_INDEX.single,
    ...WANG_5X8_BORDER,
    WANG_5X8_INDEX.innerNW,
    WANG_5X8_INDEX.innerNE,
    WANG_5X8_INDEX.innerSW,
    WANG_5X8_INDEX.innerSE,
  ]);

  const on = (bits: number, bit: number): 1 | 2 => ((bits & bit) !== 0 ? 1 : 2);
  for (let bits = 0; bits < 256; bits += 1) {
    const actual = {
      Top: on(bits, 1),
      Right: on(bits, 2),
      Bottom: on(bits, 4),
      Left: on(bits, 8),
      TopLeft: on(bits, 16),
      TopRight: on(bits, 32),
      BottomLeft: on(bits, 64),
      BottomRight: on(bits, 128),
    } satisfies Neighbors;
    const resolved = wangResolve(actual, true);
    assert.equal(allowed.has(resolved.index), true);
    assert.equal(isWang5x8Black(resolved.index), false);
    if (actual.Top === 1) {
      assert.equal(resolved.index === 0 || resolved.index === 1 || resolved.index === 2, false);
    }
    const cardinals = [actual.Top, actual.Right, actual.Bottom, actual.Left].filter((value) => value === 1).length;
    const missingDiagonal = [
      actual.TopLeft,
      actual.TopRight,
      actual.BottomLeft,
      actual.BottomRight,
    ].filter((value) => value !== 1).length;
    if (cardinals === 4 && missingDiagonal === 0) assert.equal(resolved.index, 16);
    if (cardinals === 4 && missingDiagonal === 1) {
      if (actual.TopLeft !== 1) assert.equal(resolved.index, 11);
      if (actual.TopRight !== 1) assert.equal(resolved.index, 12);
      if (actual.BottomLeft !== 1) assert.equal(resolved.index, 21);
      if (actual.BottomRight !== 1) assert.equal(resolved.index, 22);
    }
    if (cardinals === 4 && missingDiagonal >= 2) assert.equal(resolved.index, 16);
    if (cardinals === 0) assert.equal(resolved.index, 6);
    const hit = firstMatchingRule(wang.rules, actual);
    if (cardinals === 4 && missingDiagonal >= 2) {
      assert.equal(hit, null);
      assert.equal(resolved.index, wang.defaultSpriteIndex);
    } else {
      assert.equal(hit, resolved.index);
      assert.equal(wangMatchingIndex(actual, true), resolved.index);
    }
  }

  assert.equal(wangResolve(actualFromCornerMask(15), true).index, 16);
  assert.equal(wangResolve(actualFromCornerMask(0), true).index, 6);
  assert.equal(firstMatchingRule(wang.rules, actualFromCornerMask(15)), 16);
  const southEdge = {
    Top: 1, Bottom: 2, Left: 1, Right: 1, TopLeft: 2, TopRight: 2, BottomLeft: 2, BottomRight: 2,
  } satisfies Neighbors;
  assert.equal(wangMatchingIndex(southEdge, true), 26);
  assert.equal(wangResolve(southEdge, true).index, 26);
  const northEdge = {
    Top: 2, Bottom: 1, Left: 1, Right: 1, TopLeft: 2, TopRight: 2, BottomLeft: 1, BottomRight: 1,
  } satisfies Neighbors;
  assert.equal(wangResolve(northEdge, true).index, 1);
});

test("corner rules resolve the exact mask before any looser subset", () => {
  const wang = analyzeSheet({ width: 160, height: 128, tileSize: 32, preset: "wang" }).data;
  const native = analyzeSheet({ width: 256, height: 256, tileSize: 64, preset: "15-tileset" }).data;
  const packed = analyzeSheet({ width: 96, height: 160, tileSize: 32, preset: "15-tileset" }).data;
  assert.ok(wang && native && packed);

  for (let mask = 0; mask < 16; mask += 1) {
    const wangHit = firstMatchingRule(wang.rules, actualFromCornerMask(mask));
    const nativeHit = firstMatchingRule(native.rules, actualFromCornerMask(mask));
    const packedHit = firstMatchingRule(packed.rules, actualFromCornerMask(mask));
    if (mask === 0) {
      assert.equal(wangHit, null);
      assert.equal(nativeHit, null);
      assert.equal(packedHit, null);
      assert.equal(wang.defaultSpriteIndex, 0);
      assert.equal(wangResolve(actualFromCornerMask(0), false).index, 0);
      assert.equal(native.defaultSpriteIndex, 12);
      assert.equal(packed.defaultSpriteIndex, FIFTEEN_TILE_MASKS.indexOf(15));
      continue;
    }
    assert.equal(wangHit, mask);
    assert.equal(wangMatchingIndex(actualFromCornerMask(mask), false), mask);
    assert.equal(nativeHit, NATIVE_16_MASKS.indexOf(mask as (typeof NATIVE_16_MASKS)[number]));
    assert.equal(packedHit, FIFTEEN_TILE_MASKS.indexOf(mask as (typeof FIFTEEN_TILE_MASKS)[number]));
  }
});

test("Godot 47-blob rules cover every neighborhood exactly once", () => {
  const analysis = analyzeSheet({ width: 384, height: 128, tileSize: 32, preset: "godot-47" });
  assert.equal(analysis.error, null);
  const data = analysis.data;
  assert.ok(data);
  assert.equal(data.columns, 12);
  assert.equal(data.rows, 4);
  assert.equal(data.tileSize, 32);
  assert.equal(data.rules.length, 47);
  assert.equal(data.cells.length, 48);
  assert.equal(GODOT_BLOB_GRID[2]?.[9], 255);
  assert.equal(GODOT_BLOB_GRID[1]?.[10], -1);
  assert.equal(GODOT_BLOB_GRID[3]?.[0], 0);
  assert.equal(data.defaultSpriteIndex, 33);
  assert.equal(data.cells[33]?.label, "내부 바닥");
  assert.equal(data.cells[33]?.mask, 255);
  assert.equal(data.cells[33]?.x, 9 * 32);
  assert.equal(data.cells[33]?.y, 2 * 32);
  assert.equal(data.cells[22]?.role, "unmapped");
  assert.equal(new Set(data.rules.map((rule) => rule.index)).size, 47);
  assert.equal(data.rules.some((rule) => rule.index === 22), false);
  assert.equal(data.rules.some((rule) => rule.index === 33), true);
  assert.equal(data.rules[0]?.index, 33);

  const corners = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"] as const;
  const seen = new Set<string>();
  let ignored = 0;
  let filled = 0;
  let missing = 0;
  for (const rule of data.rules) {
    const signature = JSON.stringify(rule.neighbors);
    assert.equal(seen.has(signature), false);
    seen.add(signature);
    assert.equal(firstMatchingRule(data.rules, rule.neighbors), rule.index);
    for (const key of corners) {
      const value = rule.neighbors[key];
      if (value === 0) ignored += 1;
      else if (value === 1) filled += 1;
      else missing += 1;
    }
  }
  assert.ok(ignored > 0);
  assert.ok(filled > 0);
  assert.ok(missing > 0);

  const isolated = {
    Top: 2, Bottom: 2, Left: 2, Right: 2, TopLeft: 2, TopRight: 2, BottomLeft: 2, BottomRight: 2,
  } satisfies Neighbors;
  assert.equal(firstMatchingRule(data.rules, isolated), godotCellForMask(0).index);

  for (let bits = 0; bits < 256; bits += 1) {
    const actual = blobActual(bits);
    const hits = data.rules.filter((rule) => ruleMatches(rule.neighbors, actual));
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.index, godotCellForMask(canonicalBlobMask(bits)).index);
  }

  const doubled = analyzeSheet({ width: 768, height: 256, tileSize: 32, preset: "godot-47" });
  assert.equal(doubled.error, null);
  assert.equal(doubled.data?.tileSize, 64);
  assert.equal(doubled.data?.columns, 12);
  assert.equal(doubled.data?.rows, 4);
  assert.equal(doubled.data?.rules.length, 47);
  assert.equal(doubled.data?.cells[0]?.width, 64);
  assert.equal(doubled.data?.cells[0]?.height, 64);
  assert.equal(doubled.data?.defaultSpriteIndex, 33);
});

function blobActual(bits: number): Neighbors {
  const on = (bit: number): 1 | 2 => ((bits & bit) !== 0 ? 1 : 2);
  return {
    Top: on(BLOB.N),
    Bottom: on(BLOB.S),
    Left: on(BLOB.W),
    Right: on(BLOB.E),
    TopLeft: on(BLOB.NW),
    TopRight: on(BLOB.NE),
    BottomLeft: on(BLOB.SW),
    BottomRight: on(BLOB.SE),
  };
}

test("sheet size must match the preset grid", () => {
  const wrongWidth = analyzeSheet({ width: 160, height: 128, tileSize: 32, preset: "15-tileset" });
  assert.equal(wrongWidth.data, null);
  assert.match(wrongWidth.error ?? "", /3×5/);
  assert.doesNotMatch(wrongWidth.error ?? "", /가로 4칸/);
  assert.equal(wrongWidth.cells.length, 20);

  const short = analyzeSheet({ width: 96, height: 64, tileSize: 32, preset: "godot-47" });
  assert.match(short.error ?? "", /12×4/);

  const ragged = analyzeSheet({ width: 100, height: 64, tileSize: 32, preset: "wang" });
  assert.equal(ragged.cells.length, 0);
  assert.match(ragged.error ?? "", /나누어 떨어지지 않습니다/);

  const fourWide = analyzeSheet({ width: 128, height: 128, tileSize: 32, preset: "wang" });
  assert.equal(fourWide.data, null);
  assert.match(fourWide.error ?? "", /가로 5칸/);
  assert.match(fourWide.error ?? "", /4칸/);

  const shortWang = analyzeSheet({ width: 160, height: 96, tileSize: 32, preset: "wang" });
  assert.match(shortWang.error ?? "", /세로 4칸/);

  const extra = analyzeSheet({ width: 160, height: 288, tileSize: 32, preset: "wang" });
  assert.equal(extra.error, null);
  assert.match(extra.warning ?? "", /위쪽 8줄/);
  assert.equal(extra.data?.cells.length, 45);
  assert.equal(extra.data?.cells[40]?.role, "unmapped");
  assert.equal(extra.data?.cells[40]?.label, "범위 밖");
  assert.equal(extra.data?.rules.length, 20);
  assert.equal(extra.data?.defaultSpriteIndex, 16);
});

test("unity slice rects use a bottom-left origin", () => {
  assert.deepEqual(unitySliceRect(1, 0, 32, 128), { x: 32, y: 96, width: 32, height: 32 });
  assert.deepEqual(unitySliceRect(0, 3, 32, 128), { x: 0, y: 0, width: 32, height: 32 });
  assert.equal(tileSpriteName(0), "tile_00");
  assert.equal(tileSpriteName(15), "tile_15");
});

test("the unity builder slices, binds m_TilingRules, and adds both menus", () => {
  const script = buildRuleTileScript();
  assert.match(script, /MenuItem\(ToolsMenu, false, 20\)/);
  assert.match(script, /"Tools\/SpriteForge\/Build Rule Tile"/);
  assert.match(script, /"Assets\/SpriteForge\/Build Rule Tile"/);
  assert.match(script, /Selection\.activeObject is Texture2D/);
  assert.match(script, /RuleData\.json/);
  assert.match(script, /JsonUtility\.FromJson<SpriteForgeRuleData>/);
  assert.match(script, /SpriteImportMode\.Multiple/);
  assert.match(script, /FilterMode\.Point/);
  assert.match(script, /TextureImporterCompression\.Uncompressed/);
  assert.match(script, /textureImporter\.mipmapEnabled = false/);
  assert.match(script, /texture\.height - \(row \+ 1\) \* data\.tileSize/);
  assert.match(script, /data\.doubleHeight && row % 2 == 0/);
  assert.match(script, /texture\.height - \(row \+ 2\) \* data\.tileSize/);
  assert.match(script, /public bool doubleHeight;/);
  assert.match(script, /5x8/);
  assert.match(script, /case "floor": return 16;/);
  assert.match(script, /case "north": return 1;/);
  assert.match(script, /case "south": return 26;/);
  assert.match(script, /case "west": return 15;/);
  assert.match(script, /case "east": return 18;/);
  assert.match(script, /case "outer_nw": return 0;/);
  assert.match(script, /case "outer_ne": return 2;/);
  assert.match(script, /case "outer_sw": return 25;/);
  assert.match(script, /case "outer_se": return 28;/);
  assert.match(script, /case "inner_nw": return 11;/);
  assert.match(script, /case "inner_ne": return 12;/);
  assert.match(script, /case "inner_sw": return 21;/);
  assert.match(script, /case "inner_se": return 22;/);
  assert.match(script, /case "single": return 6;/);
  assert.match(script, /if \(IsWang5x8\(data\)\) return 16;/);
  assert.match(script, /index == 31 \|\| index == 32 \|\| index == 33 \|\| index == 34/);
  assert.match(script, /index == 36 \|\| index == 37 \|\| index == 38 \|\| index == 39/);
  assert.match(script, /IsWang5x8Black\(index\)\) continue;/);
  const tall = analyzeSheet({ width: 160, height: 256, tileSize: 32, preset: "wang" }).data;
  assert.ok(tall);
  for (const rule of tall.rules) {
    assert.match(script, new RegExp(`case "${rule.name}": return ${rule.index};`));
  }
  assert.match(script, /3 columns by 5 rows/);
  assert.match(script, /47 rules/);
  assert.match(script, /ScriptableObject\.CreateInstance<RuleTile>/);
  assert.match(script, /ruleTile\.m_TilingRules\.Add\(rule\)/);
  assert.match(script, /m_DefaultSprite/);
  assert.match(script, /if \(condition == 0\) return;/);
  assert.match(script, /entry\.neighbors\.TopLeft/);
  assert.match(script, /entry\.neighbors\.Top[^L]/);
  assert.match(script, /entry\.neighbors\.BottomRight/);
  assert.match(script, /new Vector3Int\(0, 1, 0\)/);
  assert.match(script, /new Vector3Int\(0, -1, 0\)/);
  assert.match(script, /RuleTile\.asset/);
  assert.match(script, /#if UNITY_EDITOR/);
  assert.doesNotMatch(script, /\$\{/);
});

test("aspect ratio picks the PixelLab preset and leaves a valid choice alone", () => {
  assert.equal(detectPreset(96, 160, 32), "15-tileset");
  assert.equal(detectPreset(128, 128, 32), "15-tileset");
  assert.equal(detectPreset(128, 256, 32), "15-tileset");
  assert.equal(detectPreset(160, 256, 32), "wang");
  assert.equal(detectPreset(160, 128, 32), "wang");
  assert.equal(detectPreset(384, 128, 32), "godot-47");
  assert.equal(detectPreset(768, 256, 32), "godot-47");
  assert.equal(detectPreset(90, 150, 32), "15-tileset");

  assert.equal(suggestPreset(128, 128, 32, "15-tileset"), "15-tileset");
  assert.equal(suggestPreset(160, 256, 32, "15-tileset"), "wang");
  assert.equal(suggestPreset(96, 160, 32, "godot-47"), "15-tileset");
  assert.equal(suggestPreset(768, 256, 32, "wang"), "godot-47");
  assert.equal(suggestPreset(160, 128, 32, "wang"), "wang");
  assert.equal(DIRECTION_KEYS.length, 8);
});
