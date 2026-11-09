import { staticScript } from "./scriptSafety.ts";

export const RULE_TILE_SIZES = [16, 32, 48, 64] as const;

export type RuleTileSize = (typeof RULE_TILE_SIZES)[number];

export const RULE_PRESETS = ["15-tileset", "wang", "godot-3x3"] as const;

export type RulePreset = (typeof RULE_PRESETS)[number];

export type NeighborValue = 0 | 1 | 2;

/** Unity RuleTile neighbour ids. 0 is absent from m_Neighbors and always passes. */
export const NEIGHBOR = {
  Ignore: 0,
  This: 1,
  NotThis: 2,
} as const;

export type Neighbors = {
  Top: NeighborValue;
  Bottom: NeighborValue;
  Left: NeighborValue;
  Right: NeighborValue;
  TopLeft: NeighborValue;
  TopRight: NeighborValue;
  BottomLeft: NeighborValue;
  BottomRight: NeighborValue;
};

export const DIRECTION_KEYS = [
  "Top",
  "Bottom",
  "Left",
  "Right",
  "TopLeft",
  "TopRight",
  "BottomLeft",
  "BottomRight",
] as const satisfies readonly (keyof Neighbors)[];

export type PresetInfo = {
  id: RulePreset;
  label: string;
  columns: number;
  rows: number;
  hint: string;
};

export const PRESET_INFO: Record<RulePreset, PresetInfo> = {
  "15-tileset": {
    id: "15-tileset",
    label: "15-tileset",
    columns: 4,
    rows: 4,
    hint: "PixelLab dual-grid 4×4. 12번은 빈 칸(기본 스프라이트), 6번은 내부 바닥입니다.",
  },
  wang: {
    id: "wang",
    label: "Wang",
    columns: 5,
    rows: 4,
    hint: "PixelLab Wang은 가로 5열입니다. 32px 정사각은 160×128(5×4), 세로 2배 트랜지션은 160×256(5×8, 40칸)입니다. NW=1, NE=2, SW=4, SE=8.",
  },
  "godot-3x3": {
    id: "godot-3x3",
    label: "Godot 3×3",
    columns: 3,
    rows: 3,
    hint: "Godot 3×3 minimal. 가운데 4번이 내부 바닥이고, 모서리는 바깥 코너, 변은 직선 엣지입니다.",
  },
};

/**
 * Standard Godot / PixelLab dual-grid 15-tile sheet, row-major.
 * Index 12 is the empty cell. Index 6 is the full floor.
 * Bits: NW=1, NE=2, SW=4, SE=8.
 */
export const FIFTEEN_TILE_MASKS = [
  4, 10, 13, 12,
  9, 14, 15, 7,
  2, 3, 11, 5,
  0, 8, 6, 1,
] as const;

/** Sheet index whose PixelLab 15-tileset cell stores this mask. Masks 0–15 are a bijection. */
export function pixelLabTileIndex(mask: number): number {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
    throw new Error("타일 마스크는 0부터 15까지입니다.");
  }
  const index = (FIFTEEN_TILE_MASKS as readonly number[]).indexOf(mask);
  if (index < 0) throw new Error("PixelLab 15-tileset에 없는 마스크입니다.");
  return index;
}

export function pixelLabSourceRect(mask: number, tileSize: number) {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  const index = pixelLabTileIndex(mask);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    index,
    x: column * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

/**
 * PixelLab "Wang tileset" export. Values are corner masks (NW=1, NE=2, SW=4, SE=8),
 * taken from the 15-tileset index template
 * [[13,3,0,7,10],[1,6,11,2,5],[8,9,15,4,14],[6,12]].
 * The last row keeps the floor and the empty cell, then three padding slots.
 * A double-height transition sheet repeats each logical row as two square rows.
 */
export const WANG_COLUMNS = 5;
export const WANG_LOGICAL_ROWS = 4;
export const WANG_MASK_ROWS = [
  [8, 12, 4, 7, 11],
  [10, 15, 5, 13, 14],
  [2, 3, 1, 9, 6],
  [15, 0, -1, -1, -1],
] as const;

export function wangDoubled(rows: number): boolean {
  return rows >= WANG_LOGICAL_ROWS * 2;
}

export function wangMappedRows(rows: number): number {
  return wangDoubled(rows) ? WANG_LOGICAL_ROWS * 2 : WANG_LOGICAL_ROWS;
}

/** Corner mask at a row-major index. -1 is padding outside the Wang template. */
export function wangCellMask(index: number, doubled: boolean): number {
  if (!Number.isInteger(index) || index < 0) return -1;
  const column = index % WANG_COLUMNS;
  const squareRow = Math.floor(index / WANG_COLUMNS);
  const limit = doubled ? WANG_LOGICAL_ROWS * 2 : WANG_LOGICAL_ROWS;
  if (squareRow >= limit) return -1;
  const logicalRow = doubled ? Math.floor(squareRow / 2) : squareRow;
  return WANG_MASK_ROWS[logicalRow][column];
}

/** First sheet index whose cell stores this mask. That cell is the full tile sprite. */
export function wangIndexForMask(mask: number, doubled: boolean): number {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
    throw new Error("타일 마스크는 0부터 15까지입니다.");
  }
  const count = WANG_COLUMNS * (doubled ? WANG_LOGICAL_ROWS * 2 : WANG_LOGICAL_ROWS);
  for (let index = 0; index < count; index += 1) {
    if (wangCellMask(index, doubled) === mask) return index;
  }
  throw new Error("Wang 시트에 없는 마스크입니다.");
}

export function wangSourceRect(mask: number, tileSize: number, doubled: boolean) {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  const index = wangIndexForMask(mask, doubled);
  const column = index % WANG_COLUMNS;
  const row = Math.floor(index / WANG_COLUMNS);
  return {
    index,
    x: column * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: doubled ? tileSize * 2 : tileSize,
  };
}

const CORNER_BITS = [
  { bit: 1, dirs: ["TopLeft", "Top", "Left"] },
  { bit: 2, dirs: ["Top", "TopRight", "Right"] },
  { bit: 4, dirs: ["Left", "BottomLeft", "Bottom"] },
  { bit: 8, dirs: ["Right", "Bottom", "BottomRight"] },
] as const;

export type SheetCell = {
  index: number;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RuleRole = "rule" | "default" | "paired" | "unmapped";

export type RuleCell = SheetCell & {
  sprite: string;
  name: string;
  label: string;
  mask: number;
  role: RuleRole;
  fallback: boolean;
  neighbors: Neighbors;
};

export type RuleEntry = {
  index: number;
  sprite: string;
  name: string;
  label: string;
  mask: number;
  neighbors: Neighbors;
};

export type RuleDataFile = {
  app: "SpriteForge";
  version: 1;
  kind: "unity-rule-tile";
  preset: RulePreset;
  tileSize: number;
  image: "Tileset.png";
  columns: number;
  rows: number;
  /** When true, even rows of a Wang sheet are the top of a tile that is two cells tall. */
  doubleHeight: boolean;
  defaultSpriteIndex: number;
  outputAsset: "RuleTile.asset";
  neighborLegend: {
    "0": "Ignore";
    "1": "This";
    "2": "NotThis";
  };
  rules: RuleEntry[];
  cells: RuleCell[];
};

export type SheetAnalysis = {
  columns: number;
  rows: number;
  cells: SheetCell[];
  data: RuleDataFile | null;
  error: string | null;
  warning: string | null;
};

type Slot = {
  index: number;
  mask: number;
  name: string;
  label: string;
  neighbors: Neighbors;
  rule: boolean;
  fallback: boolean;
};

const GODOT_3X3: readonly { name: string; label: string; neighbors: Neighbors }[] = [
  { name: "outer_nw", label: "바깥 코너", neighbors: pattern(2, 1, 2, 1, 2, 2, 2, 1) },
  { name: "edge_n", label: "직선 엣지", neighbors: pattern(2, 1, 1, 1, 2, 2, 1, 1) },
  { name: "outer_ne", label: "바깥 코너", neighbors: pattern(2, 1, 1, 2, 2, 2, 1, 2) },
  { name: "edge_w", label: "직선 엣지", neighbors: pattern(1, 1, 2, 1, 2, 1, 2, 1) },
  { name: "floor", label: "내부 바닥", neighbors: pattern(1, 1, 1, 1, 1, 1, 1, 1) },
  { name: "edge_e", label: "직선 엣지", neighbors: pattern(1, 1, 1, 2, 1, 2, 1, 2) },
  { name: "outer_sw", label: "바깥 코너", neighbors: pattern(1, 2, 2, 1, 2, 1, 2, 2) },
  { name: "edge_s", label: "직선 엣지", neighbors: pattern(1, 2, 1, 1, 1, 1, 2, 2) },
  { name: "outer_se", label: "바깥 코너", neighbors: pattern(1, 2, 1, 2, 1, 2, 2, 2) },
];

export function emptyNeighbors(): Neighbors {
  return {
    Top: 0,
    Bottom: 0,
    Left: 0,
    Right: 0,
    TopLeft: 0,
    TopRight: 0,
    BottomLeft: 0,
    BottomRight: 0,
  };
}

function pattern(
  top: NeighborValue,
  bottom: NeighborValue,
  left: NeighborValue,
  right: NeighborValue,
  topLeft: NeighborValue,
  topRight: NeighborValue,
  bottomLeft: NeighborValue,
  bottomRight: NeighborValue,
): Neighbors {
  return {
    Top: top,
    Bottom: bottom,
    Left: left,
    Right: right,
    TopLeft: topLeft,
    TopRight: topRight,
    BottomLeft: bottomLeft,
    BottomRight: bottomRight,
  };
}

export function tileSpriteName(index: number): string {
  return `tile_${String(index).padStart(2, "0")}`;
}

export function neighborsFromCornerMask(mask: number): Neighbors {
  const neighbors = emptyNeighbors();
  for (const corner of CORNER_BITS) {
    if ((mask & corner.bit) === 0) continue;
    for (const dir of corner.dirs) neighbors[dir] = 1;
  }
  return neighbors;
}

export function countCondition(neighbors: Neighbors, value: NeighborValue): number {
  let count = 0;
  for (const key of DIRECTION_KEYS) {
    if (neighbors[key] === value) count += 1;
  }
  return count;
}

export function ruleMatches(expected: Neighbors, actual: Neighbors): boolean {
  for (const key of DIRECTION_KEYS) {
    const condition = expected[key];
    if (condition === 0) continue;
    if (condition === 1 && actual[key] !== 1) return false;
    if (condition === 2 && actual[key] === 1) return false;
  }
  return true;
}

export function firstMatchingRule(
  rules: readonly { index: number; neighbors: Neighbors }[],
  actual: Neighbors,
): number | null {
  for (const rule of rules) {
    if (ruleMatches(rule.neighbors, actual)) return rule.index;
  }
  return null;
}

/** Neighbourhood Unity would see when exactly these corners are the same Rule Tile. */
export function actualFromCornerMask(mask: number): Neighbors {
  const required = neighborsFromCornerMask(mask);
  const actual = emptyNeighbors();
  for (const key of DIRECTION_KEYS) {
    actual[key] = required[key] === 1 ? 1 : 2;
  }
  return actual;
}

/** Top-left image row becomes a bottom-left Unity sprite rect. */
export function unitySliceRect(column: number, row: number, tileSize: number, textureHeight: number) {
  return {
    x: column * tileSize,
    y: textureHeight - (row + 1) * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

export function sliceSheet(width: number, height: number, tileSize: number): SheetCell[] {
  const columns = width / tileSize;
  const rows = height / tileSize;
  const cells: SheetCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        index: row * columns + column,
        column,
        row,
        x: column * tileSize,
        y: row * tileSize,
        width: tileSize,
        height: tileSize,
      });
    }
  }
  return cells;
}

function cornerLabel(mask: number): string {
  if (mask === 0) return "빈 칸";
  if (mask === 15) return "내부 바닥";
  const bits = bitCount(mask);
  if (bits === 1) return "단독 코너";
  if (bits === 3) return "삼면";
  if (bits === 2) {
    const straight = mask === 3 || mask === 5 || mask === 10 || mask === 12;
    return straight ? "직선 엣지" : "대각";
  }
  return "패턴";
}

function cornerName(mask: number): string {
  if (mask === 0) return "empty";
  if (mask === 15) return "floor";
  const parts: string[] = [];
  if (mask & 1) parts.push("nw");
  if (mask & 2) parts.push("ne");
  if (mask & 4) parts.push("sw");
  if (mask & 8) parts.push("se");
  return parts.join("_");
}

function bitCount(mask: number): number {
  let count = 0;
  let value = mask;
  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function slotsForPreset(preset: RulePreset): Slot[] {
  if (preset === "godot-3x3") {
    return GODOT_3X3.map((tile, index) => ({
      index,
      mask: -1,
      name: tile.name,
      label: tile.label,
      neighbors: tile.neighbors,
      rule: true,
      fallback: index === 4,
    }));
  }

  if (preset === "wang") {
    throw new Error("Wang 슬롯은 시트 높이에 따라 wangSlots로 만듭니다.");
  }

  return FIFTEEN_TILE_MASKS.map((mask, index) => ({
    index,
    mask,
    name: cornerName(mask),
    label: cornerLabel(mask),
    neighbors: neighborsFromCornerMask(mask),
    rule: mask !== 0,
    fallback: mask === 0,
  }));
}

function wangSlots(doubled: boolean): Slot[] {
  const count = WANG_COLUMNS * (doubled ? WANG_LOGICAL_ROWS * 2 : WANG_LOGICAL_ROWS);
  const seen = new Set<number>();
  let fallbackSet = false;
  const slots: Slot[] = [];
  for (let index = 0; index < count; index += 1) {
    const mask = wangCellMask(index, doubled);
    if (mask < 0) continue;
    const squareRow = Math.floor(index / WANG_COLUMNS);
    const paired = doubled && squareRow % 2 === 1;
    const duplicate = !paired && seen.has(mask);
    const canonical = !paired && !duplicate;
    if (canonical) seen.add(mask);
    const fallback = mask === 0 && canonical && !fallbackSet;
    if (fallback) fallbackSet = true;
    const label = paired
      ? `${cornerLabel(mask)} 아래`
      : duplicate
        ? `${cornerLabel(mask)} 복제`
        : cornerLabel(mask);
    slots.push({
      index,
      mask,
      name: cornerName(mask),
      label,
      neighbors: neighborsFromCornerMask(mask),
      rule: mask !== 0 && canonical,
      fallback,
    });
  }
  return slots;
}

function cloneNeighbors(neighbors: Neighbors): Neighbors {
  return { ...neighbors };
}

export function analyzeSheet(input: {
  width: number;
  height: number;
  tileSize: number;
  preset: RulePreset;
}): SheetAnalysis {
  const empty: SheetAnalysis = { columns: 0, rows: 0, cells: [], data: null, error: null, warning: null };
  if (!Number.isInteger(input.tileSize) || input.tileSize <= 0) {
    return { ...empty, error: "타일 크기는 양의 정수여야 합니다." };
  }
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0) {
    return { ...empty, error: "이미지 크기를 읽지 못했습니다." };
  }
  if (input.width % input.tileSize !== 0 || input.height % input.tileSize !== 0) {
    return {
      ...empty,
      error: `이미지 ${input.width}×${input.height}px가 ${input.tileSize}×${input.tileSize} 타일로 나누어 떨어지지 않습니다.`,
    };
  }

  const columns = input.width / input.tileSize;
  const rows = input.height / input.tileSize;
  const cells = sliceSheet(input.width, input.height, input.tileSize);
  const preset = PRESET_INFO[input.preset];
  const base = { columns, rows, cells, data: null, warning: null };

  if (columns !== preset.columns) {
    return {
      ...base,
      error: `${preset.label} 프리셋은 가로 ${preset.columns}칸입니다. 이 시트는 ${columns}칸입니다.`,
    };
  }

  let mappedRows = preset.rows;
  let doubled = false;
  if (input.preset === "wang") {
    if (rows !== WANG_LOGICAL_ROWS && rows < WANG_LOGICAL_ROWS * 2) {
      return {
        ...base,
        error: `${preset.label} 프리셋은 세로 4칸(정사각) 또는 8칸(세로 2배)입니다. 현재 ${rows}칸입니다.`,
      };
    }
    doubled = wangDoubled(rows);
    mappedRows = wangMappedRows(rows);
  } else if (rows < preset.rows) {
    return {
      ...base,
      error: `${preset.label} 프리셋은 세로 ${preset.rows}칸이 필요합니다. 현재 ${rows}칸입니다.`,
    };
  }

  const slots = input.preset === "wang" ? wangSlots(doubled) : slotsForPreset(input.preset);
  const slotByIndex = new Map(slots.map((slot) => [slot.index, slot]));
  const fallback = slots.find((slot) => slot.fallback);
  if (!fallback) {
    return { ...base, error: "프리셋에 기본 스프라이트가 없습니다." };
  }

  const mappedCells: RuleCell[] = cells.map((cell) => {
    const slot = slotByIndex.get(cell.index);
    if (!slot || cell.row >= mappedRows) {
      return {
        ...cell,
        sprite: tileSpriteName(cell.index),
        name: "unmapped",
        label: "범위 밖",
        mask: -1,
        role: "unmapped",
        fallback: false,
        neighbors: emptyNeighbors(),
      };
    }
    return {
      ...cell,
      sprite: tileSpriteName(cell.index),
      name: slot.name,
      label: slot.label,
      mask: slot.mask,
      role: slot.rule ? "rule" : slot.fallback ? "default" : "paired",
      fallback: slot.fallback,
      neighbors: cloneNeighbors(slot.neighbors),
    };
  });

  const rules = slots
    .filter((slot) => slot.rule)
    .map((slot) => ({
      slot,
      weight: countCondition(slot.neighbors, 1) * 10 + countCondition(slot.neighbors, 2),
    }))
    .sort((a, b) => b.weight - a.weight || a.slot.index - b.slot.index)
    .map(({ slot }) => ({
      index: slot.index,
      sprite: tileSpriteName(slot.index),
      name: slot.name,
      label: slot.label,
      mask: slot.mask,
      neighbors: cloneNeighbors(slot.neighbors),
    }));

  const warning = rows > mappedRows
    ? `세로가 ${rows}칸입니다. 위쪽 ${mappedRows}줄만 룰에 넣습니다.`
    : null;

  return {
    columns,
    rows,
    cells,
    warning,
    error: null,
    data: {
      app: "SpriteForge",
      version: 1,
      kind: "unity-rule-tile",
      preset: input.preset,
      tileSize: input.tileSize,
      image: "Tileset.png",
      columns,
      rows,
      doubleHeight: doubled,
      defaultSpriteIndex: fallback.index,
      outputAsset: "RuleTile.asset",
      neighborLegend: { "0": "Ignore", "1": "This", "2": "NotThis" },
      rules,
      cells: mappedCells,
    },
  };
}

export function buildRuleTileScript(): string {
  return staticScript`// SpriteForge — drop this file in an Editor folder (the zip already does).
// Select Tileset.png, then run Tools/SpriteForge/Build Rule Tile
// or right-click the texture and choose SpriteForge/Build Rule Tile.
// Requires Unity 2021.2+ and the 2D Tilemap Extras package (com.unity.2d.tilemap.extras).
//
// RuleData.json neighbor values: 0 = Ignore, 1 = This, 2 = NotThis.
// Rules are stored in check order. Unity uses the first match, then m_DefaultSprite.
// Corner sheets (15-tileset, Wang) mark the three cells around each filled corner as This
// and leave the rest Ignore, with stricter rules first.
// Wang sheets are 5 columns. Square tiles use 4 rows. A double-height transition
// sheet is 8 rows (40 cells); doubleHeight makes each even row's sprite two cells tall
// and RuleData.json indexes that 5x8 grid. The lower half keeps the same mask.
// Godot 3x3 marks every direction This or NotThis.
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;
using UnityEngine.Tilemaps;

public static class RuleTileBuilder
{
    private const string ToolsMenu = "Tools/SpriteForge/Build Rule Tile";
    private const string AssetMenu = "Assets/SpriteForge/Build Rule Tile";

    [MenuItem(ToolsMenu, false, 20)]
    public static void BuildFromToolsMenu()
    {
        BuildRuleTile();
    }

    [MenuItem(AssetMenu, false, 1000)]
    public static void BuildFromAssetMenu()
    {
        BuildRuleTile();
    }

    [MenuItem(AssetMenu, true)]
    public static bool ValidateAssetMenu()
    {
        return Selection.activeObject is Texture2D;
    }

    public static void BuildRuleTile()
    {
        var texture = Selection.activeObject as Texture2D;
        if (texture == null)
        {
            EditorUtility.DisplayDialog("SpriteForge", "Project 창에서 Tileset.png 를 선택한 뒤 다시 실행하세요.", "확인");
            return;
        }

        var texturePath = AssetDatabase.GetAssetPath(texture);
        var directory = Path.GetDirectoryName(texturePath);
        var jsonPath = Path.Combine(directory ?? string.Empty, "RuleData.json");
        if (!File.Exists(jsonPath))
        {
            EditorUtility.DisplayDialog("SpriteForge", "같은 폴더에 RuleData.json 이 없습니다.", "확인");
            return;
        }

        SpriteForgeRuleData data;
        try
        {
            data = JsonUtility.FromJson<SpriteForgeRuleData>(File.ReadAllText(jsonPath));
        }
        catch (Exception exception)
        {
            EditorUtility.DisplayDialog("SpriteForge", "RuleData.json 을 읽지 못했습니다.\\n" + exception.Message, "확인");
            return;
        }

        if (data == null || data.tileSize <= 0 || data.columns <= 0 || data.rows <= 0 || data.rules == null || data.rules.Length == 0)
        {
            EditorUtility.DisplayDialog("SpriteForge", "RuleData.json 에 tileSize, columns, rows 또는 rules 가 없습니다.", "확인");
            return;
        }

        var textureImporter = AssetImporter.GetAtPath(texturePath) as TextureImporter;
        if (textureImporter == null)
        {
            EditorUtility.DisplayDialog("SpriteForge", "TextureImporter 를 찾지 못했습니다.", "확인");
            return;
        }

        try
        {
            ConfigureImporter(textureImporter, data.tileSize);
            textureImporter.SaveAndReimport();

            texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            if (texture == null)
            {
                throw new InvalidOperationException("슬라이스한 텍스처를 다시 열지 못했습니다.");
            }

            if (texture.width != data.columns * data.tileSize || texture.height != data.rows * data.tileSize)
            {
                EditorUtility.DisplayDialog(
                    "SpriteForge",
                    "PNG 크기가 RuleData.json 의 columns, rows, tileSize 와 맞지 않습니다.",
                    "확인");
                return;
            }

            SliceGrid(textureImporter, texture, data);
            var sprites = LoadSprites(texturePath);
            var ruleTile = CreateRuleTile(data, sprites);
            var assetPath = ((directory ?? "Assets") + "/RuleTile.asset").Replace('\\\\', '/');
            if (AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) != null)
            {
                AssetDatabase.DeleteAsset(assetPath);
            }

            AssetDatabase.CreateAsset(ruleTile, assetPath);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Selection.activeObject = ruleTile;
            EditorGUIUtility.PingObject(ruleTile);
            EditorUtility.DisplayDialog(
                "SpriteForge",
                "Rule Tile을 만들었습니다.\\n" + assetPath + "\\n룰 " + ruleTile.m_TilingRules.Count + "개, 기본 스프라이트 tile_" + data.defaultSpriteIndex.ToString("00"),
                "확인");
        }
        catch (Exception exception)
        {
            Debug.LogException(exception);
            EditorUtility.DisplayDialog("SpriteForge", exception.Message, "확인");
        }
    }

    private static void ConfigureImporter(TextureImporter textureImporter, int tileSize)
    {
        textureImporter.textureType = TextureImporterType.Sprite;
        textureImporter.spriteImportMode = SpriteImportMode.Multiple;
        textureImporter.alphaIsTransparency = true;
        textureImporter.npotScale = TextureImporterNPOTScale.None;
        textureImporter.mipmapEnabled = false;
        textureImporter.maxTextureSize = 8192;
        textureImporter.spritePixelsPerUnit = tileSize;
        textureImporter.filterMode = FilterMode.Point;
        textureImporter.textureCompression = TextureImporterCompression.Uncompressed;
        textureImporter.crunchedCompression = false;

        var settings = new TextureImporterSettings();
        textureImporter.ReadTextureSettings(settings);
        settings.spriteMeshType = SpriteMeshType.FullRect;
        settings.spriteExtrude = 0;
        settings.filterMode = FilterMode.Point;
        settings.mipmapEnabled = false;
        settings.alphaIsTransparency = true;
        textureImporter.SetTextureSettings(settings);

        var platform = textureImporter.GetDefaultPlatformTextureSettings();
        platform.textureCompression = TextureImporterCompression.Uncompressed;
        platform.crunchedCompression = false;
        textureImporter.SetPlatformTextureSettings(platform);
    }

    private static void SliceGrid(TextureImporter textureImporter, Texture2D texture, SpriteForgeRuleData data)
    {
        var factories = new SpriteDataProviderFactories();
        factories.Init();
        var dataProvider = factories.GetSpriteEditorDataProviderFromObject(textureImporter);
        dataProvider.InitSpriteEditorDataProvider();

        var count = data.columns * data.rows;
        var rects = new SpriteRect[count];
        var pairs = new SpriteNameFileIdPair[count];
        var index = 0;
        for (var row = 0; row < data.rows; row++)
        {
            for (var column = 0; column < data.columns; column++)
            {
                var spriteId = GUID.Generate();
                var name = "tile_" + index.ToString("00");
                var spriteHeight = data.tileSize;
                var unityY = texture.height - (row + 1) * data.tileSize;
                if (data.doubleHeight && row % 2 == 0)
                {
                    spriteHeight = data.tileSize * 2;
                    unityY = texture.height - (row + 2) * data.tileSize;
                }
                rects[index] = new SpriteRect
                {
                    name = name,
                    spriteID = spriteId,
                    rect = new Rect(column * data.tileSize, unityY, data.tileSize, spriteHeight),
                    alignment = SpriteAlignment.Center,
                    pivot = new Vector2(0.5f, 0.5f),
                    border = Vector4.zero
                };
                pairs[index] = new SpriteNameFileIdPair(name, spriteId);
                index++;
            }
        }

        dataProvider.SetSpriteRects(rects);
        var nameFileIdProvider = dataProvider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        if (nameFileIdProvider != null)
        {
            nameFileIdProvider.SetNameFileIdPairs(pairs);
        }

        dataProvider.Apply();
        textureImporter.SaveAndReimport();
    }

    private static Dictionary<string, Sprite> LoadSprites(string texturePath)
    {
        var lookup = new Dictionary<string, Sprite>();
        foreach (var asset in AssetDatabase.LoadAllAssetRepresentationsAtPath(texturePath))
        {
            var sprite = asset as Sprite;
            if (sprite != null) lookup[sprite.name] = sprite;
        }
        return lookup;
    }

    private static RuleTile CreateRuleTile(SpriteForgeRuleData data, Dictionary<string, Sprite> sprites)
    {
        var ruleTile = ScriptableObject.CreateInstance<RuleTile>();
        ruleTile.m_DefaultSprite = RequireSprite(sprites, data.defaultSpriteIndex);
        ruleTile.m_DefaultColliderType = Tile.ColliderType.Sprite;

        var id = 0;
        foreach (var entry in data.rules)
        {
            if (entry == null || entry.neighbors == null)
            {
                throw new InvalidOperationException("RuleData.json 룰에 neighbors 가 없습니다.");
            }

            var rule = new RuleTile.TilingRule();
            rule.m_Id = id++;
            rule.m_Output = RuleTile.TilingRuleOutput.OutputSprite.Single;
            rule.m_ColliderType = Tile.ColliderType.Sprite;
            rule.m_RuleTransform = RuleTile.TilingRuleOutput.Transform.Fixed;
            rule.m_Sprites[0] = RequireSprite(sprites, entry.index);
            rule.m_NeighborPositions = new List<Vector3Int>();
            rule.m_Neighbors = new List<int>();
            AddNeighbor(rule, new Vector3Int(-1, 1, 0), entry.neighbors.TopLeft);
            AddNeighbor(rule, new Vector3Int(0, 1, 0), entry.neighbors.Top);
            AddNeighbor(rule, new Vector3Int(1, 1, 0), entry.neighbors.TopRight);
            AddNeighbor(rule, new Vector3Int(-1, 0, 0), entry.neighbors.Left);
            AddNeighbor(rule, new Vector3Int(1, 0, 0), entry.neighbors.Right);
            AddNeighbor(rule, new Vector3Int(-1, -1, 0), entry.neighbors.BottomLeft);
            AddNeighbor(rule, new Vector3Int(0, -1, 0), entry.neighbors.Bottom);
            AddNeighbor(rule, new Vector3Int(1, -1, 0), entry.neighbors.BottomRight);
            ruleTile.m_TilingRules.Add(rule);
        }

        return ruleTile;
    }

    private static void AddNeighbor(RuleTile.TilingRule rule, Vector3Int position, int condition)
    {
        if (condition == 0) return;
        rule.m_NeighborPositions.Add(position);
        rule.m_Neighbors.Add(condition);
    }

    private static Sprite RequireSprite(Dictionary<string, Sprite> sprites, int index)
    {
        var name = "tile_" + index.ToString("00");
        Sprite sprite;
        if (!sprites.TryGetValue(name, out sprite) || sprite == null)
        {
            throw new InvalidOperationException("스프라이트 " + name + " 을 찾지 못했습니다. 슬라이스 순서가 시트와 다릅니다.");
        }
        return sprite;
    }
}

[System.Serializable]
public class SpriteForgeRuleData
{
    public string app;
    public int version;
    public string preset;
    public int tileSize;
    public int columns;
    public int rows;
    public bool doubleHeight;
    public int defaultSpriteIndex;
    public SpriteForgeRuleEntry[] rules;
}

[System.Serializable]
public class SpriteForgeRuleEntry
{
    public int index;
    public string sprite;
    public string name;
    public string label;
    public int mask;
    public SpriteForgeNeighbors neighbors;
}

[System.Serializable]
public class SpriteForgeNeighbors
{
    public int Top;
    public int Bottom;
    public int Left;
    public int Right;
    public int TopLeft;
    public int TopRight;
    public int BottomLeft;
    public int BottomRight;
}
#endif
`;
}
