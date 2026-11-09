import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIFTEEN_TILE_MASKS,
  WANG_MASK_ROWS,
  actualFromCornerMask,
  analyzeSheet,
  buildRuleTileScript,
  countCondition,
  firstMatchingRule,
  neighborsFromCornerMask,
  tileSpriteName,
  unitySliceRect,
  wangCellMask,
  wangIndexForMask,
  wangSourceRect,
  type Neighbors,
} from "./ruleTile.ts";

test("the 15-tile template is the Godot sheet, not mask order", () => {
  assert.equal(new Set(FIFTEEN_TILE_MASKS).size, 16);
  assert.deepEqual([...FIFTEEN_TILE_MASKS].sort((a, b) => a - b), [...Array(16).keys()]);
  assert.equal(FIFTEEN_TILE_MASKS[12], 0);
  assert.equal(FIFTEEN_TILE_MASKS[6], 15);
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

test("15-tileset emits 15 rules in strictest-first order", () => {
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

test("PixelLab Wang accepts a 5-column sheet and maps every 5x8 cell", () => {
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
  assert.equal(squareData.defaultSpriteIndex, wangIndexForMask(0, false));
  assert.equal(squareData.cells[16]?.mask, 0);
  assert.equal(squareData.cells[16]?.role, "default");
  assert.equal(squareData.cells[17]?.role, "unmapped");
  assert.equal(squareData.cells[15]?.role, "paired");
  assert.equal(squareData.cells[15]?.mask, 15);

  const tall = analyzeSheet({ width: 160, height: 256, tileSize: 32, preset: "wang" });
  assert.equal(tall.error, null);
  assert.equal(tall.warning, null);
  const data = tall.data;
  assert.ok(data);
  assert.equal(data.columns, 5);
  assert.equal(data.rows, 8);
  assert.equal(data.doubleHeight, true);
  assert.equal(data.cells.length, 40);
  assert.equal(data.rules.length, 15);
  assert.equal(data.defaultSpriteIndex, 31);
  assert.equal(data.rules.some((rule) => rule.index === data.defaultSpriteIndex), false);

  for (let index = 0; index < 40; index += 1) {
    const mask = wangCellMask(index, true);
    assert.equal(data.cells[index]?.mask, mask);
    if (mask < 0) {
      assert.equal(data.cells[index]?.role, "unmapped");
      continue;
    }
    const canonical = wangIndexForMask(mask, true);
    if (index === canonical) {
      assert.equal(data.cells[index]?.role, mask === 0 ? "default" : "rule");
      if (mask !== 0) {
        const rule = data.rules.find((entry) => entry.index === index);
        assert.ok(rule);
        assert.deepEqual(rule.neighbors, neighborsFromCornerMask(mask));
      }
    } else {
      assert.equal(data.cells[index]?.role, "paired");
      assert.deepEqual(data.cells[index]?.neighbors, neighborsFromCornerMask(mask));
    }
  }

  assert.deepEqual(
    WANG_MASK_ROWS[0],
    [0, 1, 2, 3, 4].map((column) => wangCellMask(column, true)),
  );
  assert.equal(wangCellMask(0, true), wangCellMask(5, true));
  assert.equal(data.cells[0]?.mask, 8);
  assert.equal(data.cells[3]?.mask, 7);
  assert.equal(data.cells[4]?.mask, 11);
  assert.deepEqual(wangSourceRect(7, 32, true), { index: 3, x: 96, y: 0, width: 32, height: 64 });
  assert.equal(wangSourceRect(10, 32, true).index, 10);
  assert.equal(wangSourceRect(0, 32, true).index, 31);

  let previous = Infinity;
  for (const rule of data.rules) {
    const weight = countCondition(rule.neighbors, 1);
    assert.ok(weight <= previous);
    previous = weight;
  }
  assert.equal(data.rules[0]?.name, "floor");
  assert.equal(data.rules[0]?.index, wangIndexForMask(15, true));
  const json = JSON.stringify(data);
  assert.match(json, /"doubleHeight":true/);
  assert.match(json, /"columns":5/);
  assert.match(json, /"rows":8/);
});

test("corner rules resolve the exact mask before any looser subset", () => {
  const wang = analyzeSheet({ width: 160, height: 256, tileSize: 32, preset: "wang" }).data;
  const fifteen = analyzeSheet({ width: 256, height: 256, tileSize: 64, preset: "15-tileset" }).data;
  assert.ok(wang && fifteen);

  for (let mask = 0; mask < 16; mask += 1) {
    const wangHit = firstMatchingRule(wang.rules, actualFromCornerMask(mask));
    const fifteenHit = firstMatchingRule(fifteen.rules, actualFromCornerMask(mask));
    if (mask === 0) {
      assert.equal(wangHit, null);
      assert.equal(fifteenHit, null);
      assert.equal(wang.defaultSpriteIndex, wangIndexForMask(0, true));
      assert.equal(fifteen.defaultSpriteIndex, 12);
      continue;
    }
    assert.equal(wangHit, wangIndexForMask(mask, true));
    assert.equal(fifteenHit, FIFTEEN_TILE_MASKS.indexOf(mask as (typeof FIFTEEN_TILE_MASKS)[number]));
  }

  assert.equal(firstMatchingRule(wang.rules, actualFromCornerMask(15)), wangIndexForMask(15, true));
  assert.notEqual(firstMatchingRule(wang.rules, actualFromCornerMask(15)), wangIndexForMask(1, true));
});

test("Godot 3x3 rules are mutually exclusive and the center is the fallback", () => {
  const analysis = analyzeSheet({ width: 96, height: 96, tileSize: 32, preset: "godot-3x3" });
  assert.equal(analysis.error, null);
  const data = analysis.data;
  assert.ok(data);
  assert.equal(data.rules.length, 9);
  assert.equal(data.defaultSpriteIndex, 4);
  assert.equal(data.rules.some((rule) => rule.index === 4), true);
  assert.equal(data.cells[4]?.label, "내부 바닥");
  assert.equal(data.cells[0]?.label, "바깥 코너");
  assert.equal(data.cells[1]?.label, "직선 엣지");

  const seen = new Set<string>();
  for (const rule of data.rules) {
    const signature = JSON.stringify(rule.neighbors);
    assert.equal(seen.has(signature), false);
    seen.add(signature);
    assert.equal(firstMatchingRule(data.rules, rule.neighbors), rule.index);
  }

  const none = {
    Top: 2, Bottom: 2, Left: 2, Right: 2, TopLeft: 2, TopRight: 2, BottomLeft: 2, BottomRight: 2,
  } satisfies Neighbors;
  assert.equal(firstMatchingRule(data.rules, none), null);

  const innerCorner = { ...data.cells[4]!.neighbors, TopLeft: 2 } satisfies Neighbors;
  assert.equal(firstMatchingRule(data.rules, innerCorner), null);

  let overlaps = 0;
  const keys = ["Top", "Bottom", "Left", "Right", "TopLeft", "TopRight", "BottomLeft", "BottomRight"] as const;
  for (let bits = 0; bits < 256; bits += 1) {
    const actual = { ...none };
    keys.forEach((key, index) => {
      actual[key] = (bits & (1 << index)) === 0 ? 2 : 1;
    });
    const hits = data.rules.filter((rule) => firstMatchingRule([rule], actual) === rule.index);
    if (hits.length > 1) overlaps += 1;
  }
  assert.equal(overlaps, 0);
});

test("sheet size must match the preset grid", () => {
  const wrongWidth = analyzeSheet({ width: 160, height: 128, tileSize: 32, preset: "15-tileset" });
  assert.equal(wrongWidth.data, null);
  assert.match(wrongWidth.error ?? "", /가로 4칸/);
  assert.equal(wrongWidth.cells.length, 20);

  const short = analyzeSheet({ width: 96, height: 64, tileSize: 32, preset: "godot-3x3" });
  assert.match(short.error ?? "", /세로 3칸/);

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
  assert.equal(extra.data?.rules.length, 15);
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
