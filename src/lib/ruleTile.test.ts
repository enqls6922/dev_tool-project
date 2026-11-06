import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIFTEEN_TILE_MASKS,
  actualFromCornerMask,
  analyzeSheet,
  buildRuleTileScript,
  countCondition,
  firstMatchingRule,
  neighborsFromCornerMask,
  tileSpriteName,
  unitySliceRect,
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

test("15-tileset and Wang emit 15 rules in strictest-first order", () => {
  for (const preset of ["15-tileset", "wang"] as const) {
    const analysis = analyzeSheet({ width: 128, height: 128, tileSize: 32, preset });
    assert.equal(analysis.error, null);
    const data = analysis.data;
    assert.ok(data);
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
  }
});

test("corner rules resolve the exact mask before any looser subset", () => {
  const wang = analyzeSheet({ width: 64, height: 64, tileSize: 16, preset: "wang" }).data;
  const fifteen = analyzeSheet({ width: 256, height: 256, tileSize: 64, preset: "15-tileset" }).data;
  assert.ok(wang && fifteen);

  for (let mask = 0; mask < 16; mask += 1) {
    const wangHit = firstMatchingRule(wang.rules, actualFromCornerMask(mask));
    const fifteenHit = firstMatchingRule(fifteen.rules, actualFromCornerMask(mask));
    if (mask === 0) {
      assert.equal(wangHit, null);
      assert.equal(fifteenHit, null);
      assert.equal(wang.defaultSpriteIndex, 0);
      assert.equal(fifteen.defaultSpriteIndex, 12);
      continue;
    }
    assert.equal(wangHit, mask);
    assert.equal(fifteenHit, FIFTEEN_TILE_MASKS.indexOf(mask as (typeof FIFTEEN_TILE_MASKS)[number]));
  }

  assert.equal(firstMatchingRule(wang.rules, actualFromCornerMask(15)), 15);
  assert.notEqual(firstMatchingRule(wang.rules, actualFromCornerMask(15)), 1);
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

  const tall = analyzeSheet({ width: 128, height: 160, tileSize: 32, preset: "wang" });
  assert.equal(tall.error, null);
  assert.match(tall.warning ?? "", /위쪽 4줄/);
  assert.equal(tall.data?.rules.length, 15);
  assert.equal(tall.data?.cells.length, 20);
  assert.equal(tall.data?.cells[16]?.role, "unmapped");
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
