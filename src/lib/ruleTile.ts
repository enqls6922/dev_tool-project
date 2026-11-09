import { staticScript } from "./scriptSafety.ts";

export const RULE_TILE_SIZES = [16, 32, 48, 64] as const;

export type RuleTileSize = (typeof RULE_TILE_SIZES)[number];

export const RULE_PRESETS = ["godot-47", "wang", "15-tileset"] as const;

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
    label: "PixelLab 15-tileset (3×5)",
    columns: 3,
    rows: 5,
    hint: "PixelLab 15-tileset은 가로 3열·세로 5행, 총 15칸입니다. 인덱스 0–14가 코너 마스크 1–15이고, 각 마스크를 8방향 이웃 규칙으로 바꿉니다. NW=1, NE=2, SW=4, SE=8.",
  },
  "godot-47": {
    id: "godot-47",
    label: "PixelLab Godot (47-Blob)",
    columns: 12,
    rows: 4,
    hint: "Godot 표준 3×3 Minimal(47-Blob)은 12×4 고정 배열입니다. 칸의 픽셀은 column×타일크기, row×타일크기이고 Unity 47-RuleTile 8방향 룰과 1:1입니다. 24×8 시트는 2×2를 한 타일로 읽습니다.",
  },
  wang: {
    id: "wang",
    label: "PixelLab Wang (5×8, 40타일)",
    columns: 5,
    rows: 8,
    hint: "5×8(160×256, 32px, 40칸)은 고정 인덱스입니다. 기본 스프라이트와 내부 바닥은 tile_16, 북쪽 tile_11, 남쪽 tile_21, 서쪽 tile_15, 동쪽 tile_17, 외곽 코너 tile_10·12·20·22, 안쪽 코너 tile_24·23·29·28, 고립과 세로 통로 하단은 tile_13, 세로 통로는 tile_08·03입니다. 31–34와 36–39는 빈칸이라 룰에 쓰지 않습니다. 5×4는 인덱스 = NW + 2·NE + 4·SW + 8·SE 입니다.",
  },
};

export type FifteenShape = "3x5" | "4x4";

/**
 * PixelLab native dual-grid roles, row-major on a 4×4 sheet.
 * Index 12 is empty (mask 0). Index 6 is the full floor (mask 15).
 * Bits: NW=1, NE=2, SW=4, SE=8.
 */
export const NATIVE_16_MASKS = [
  4, 10, 13, 12,
  9, 14, 15, 7,
  2, 3, 11, 5,
  0, 8, 6, 1,
] as const;

/**
 * PixelLab 15-tileset packed as 3 columns × 5 rows (indices 0–14).
 * The native empty cell is omitted. Order follows the native 4×4 with that cell removed.
 */
export const FIFTEEN_TILE_MASKS = [
  4, 10, 13,
  12, 9, 14,
  15, 7, 2,
  3, 11, 5,
  8, 6, 1,
] as const;

export const FIFTEEN_COLUMNS = 3;
export const FIFTEEN_ROWS = 5;

export function fifteenShape(columns: number, rows: number): FifteenShape | null {
  if (columns === FIFTEEN_COLUMNS && rows >= FIFTEEN_ROWS) return "3x5";
  if (columns === 4 && rows >= 4) return "4x4";
  return null;
}

function fifteenMasks(shape: FifteenShape): readonly number[] {
  return shape === "4x4" ? NATIVE_16_MASKS : FIFTEEN_TILE_MASKS;
}

function fifteenColumns(shape: FifteenShape): number {
  return shape === "4x4" ? 4 : FIFTEEN_COLUMNS;
}

/** Sheet index whose PixelLab 15-tileset cell stores this mask. */
export function pixelLabTileIndex(mask: number, shape: FifteenShape = "3x5"): number {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
    throw new Error("타일 마스크는 0부터 15까지입니다.");
  }
  const masks = fifteenMasks(shape);
  const index = masks.indexOf(mask);
  if (index >= 0) return index;
  if (shape === "3x5" && mask === 0) return masks.indexOf(15);
  throw new Error("PixelLab 15-tileset에 없는 마스크입니다.");
}

export function pixelLabSourceRect(mask: number, tileSize: number, shape: FifteenShape = "3x5") {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  const index = pixelLabTileIndex(mask, shape);
  const columns = fifteenColumns(shape);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    index,
    x: column * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

/**
 * PixelLab Wang sheet, 5 columns.
 *
 * A 5×4 sheet stores the 16 corner masks in index order.
 * Bits: NW=1, NE=2, SW=4, SE=8. Tile 15 is the full floor and tile 0 is the
 * isolated default. Indices 16–19 are padding.
 *
 * A 5×8 sheet (160×256 at 32px, 40 cells) does not use that formula.
 * `WANG_5X8_INDEX` is the sheet position of each role. Indices 31–34 and 36–39
 * are empty cells and are never rules. tile_00–02 and tile_05–07 are the north
 * wall header and pillar faces. They are drawn as a sandbox overlay, not as rules.
 */
export const WANG_COLUMNS = 5;
export const WANG_LOGICAL_ROWS = 4;
export const WANG_FULL_ROWS = 8;
/** Full-center floor on a 5×8 sheet. Also the default sprite. */
export const WANG_TALL_FLOOR_INDEX = 16;

/**
 * Fixed 5×8 roles. These numbers are the 16668.png cells and must stay put.
 * Left three columns: header 00–02, pillar 05–07, north lip 10–12,
 * center floor 15–17, south lip 20–22, outside floor 25–27.
 */
export const WANG_5X8_INDEX = {
  floor: 16,
  defaultSprite: 16,
  north: 11,
  south: 21,
  west: 15,
  east: 17,
  outerNW: 10,
  outerNE: 12,
  outerSW: 20,
  outerSE: 22,
  innerNW: 24,
  innerNE: 23,
  innerSW: 29,
  innerSE: 28,
  single: 13,
  corridorNS: 8,
  corridorNSTop: 3,
  corridorNSBottom: 13,
} as const;

/**
 * Sandbox pillar drawn on the empty cell above a north lip.
 * tile_10 → tile_05, tile_11 → tile_06, tile_12 → tile_07.
 */
export const WANG_5X8_PILLAR_OVERLAY = {
  10: 5,
  11: 6,
  12: 7,
} as const;

/** Sprites a solid 5×8 rectangle may use on its outer border. */
export const WANG_5X8_BORDER = [10, 11, 12, 15, 17, 20, 21, 22] as const;

/** Empty cells on the 5×8 sheet. Never a rule sprite. */
export const WANG_5X8_BLACK = [31, 32, 33, 34, 36, 37, 38, 39] as const;

/** Wall header and pillar faces. Overlay only, never a terrain rule. */
export const WANG_5X8_WALL_GRAPHICS = [0, 1, 2, 5, 6, 7] as const;

const WANG_5X8_BLACK_SET = new Set<number>(WANG_5X8_BLACK);
const WANG_5X8_WALL_SET = new Set<number>(WANG_5X8_WALL_GRAPHICS);

/** Pillar sprite for a north-lip terrain index, or null. */
export function wangNorthPillarOverlay(index: number): 5 | 6 | 7 | null {
  if (index === 10) return WANG_5X8_PILLAR_OVERLAY[10];
  if (index === 11) return WANG_5X8_PILLAR_OVERLAY[11];
  if (index === 12) return WANG_5X8_PILLAR_OVERLAY[12];
  return null;
}

export function isWang5x8Black(index: number): boolean {
  return WANG_5X8_BLACK_SET.has(index);
}

export function wangEdgeBand(rows: number): boolean {
  return rows >= WANG_FULL_ROWS;
}

export function wangMappedRows(rows: number): number {
  return wangEdgeBand(rows) ? WANG_FULL_ROWS : WANG_LOGICAL_ROWS;
}

function assertWangMask(mask: number): void {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
    throw new Error("타일 마스크는 0부터 15까지입니다.");
  }
}

/**
 * Sheet index of a 5×4 corner mask. The index is the mask.
 * A 5×8 sheet does not use this formula.
 */
export function wangSurfaceIndex(mask: number, tall: boolean): number {
  assertWangMask(mask);
  if (tall) {
    throw new Error("5×8 Wang 시트는 코너 마스크가 아니라 고정 인덱스 테이블을 사용합니다.");
  }
  return mask;
}

/** Sheet index whose 5×4 cell stores this mask. */
export function wangIndexForMask(mask: number, tall = false): number {
  return wangSurfaceIndex(mask, tall);
}

/**
 * Corner mask at a row-major index on a 5×4 sheet. -1 is padding.
 * A 5×8 sheet has no mask-per-cell formula, so every tall index is -1.
 */
export function wangCellMask(index: number, tall = false): number {
  if (tall || !Number.isInteger(index) || index < 0) return -1;
  const column = index % WANG_COLUMNS;
  const row = Math.floor(index / WANG_COLUMNS);
  if (row >= WANG_LOGICAL_ROWS) return -1;
  const local = row * WANG_COLUMNS + column;
  return local <= 15 ? local : -1;
}

/** 5×8 cells are independent sprites. There is no paired wall half. */
export function wangIsWallHalf(index: number, tall: boolean): boolean {
  return tall && index < 0;
}

export function wangSourceRect(mask: number, tileSize: number, tall = false) {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  const index = wangSurfaceIndex(mask, tall);
  const column = index % WANG_COLUMNS;
  const row = Math.floor(index / WANG_COLUMNS);
  return {
    index,
    x: column * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

export function wangRectForIndex(index: number, tileSize: number) {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Wang 시트에 없는 칸입니다.");
  }
  const column = index % WANG_COLUMNS;
  const row = Math.floor(index / WANG_COLUMNS);
  return {
    index,
    x: column * tileSize,
    y: row * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

/** Godot 3×3 minimal / PixelLab Godot sheet. 12×4 template, one cell unused. */
export const GODOT_COLUMNS = 12;
export const GODOT_ROWS = 4;
export const GODOT_FULL_MASK = 255;

/** 8-direction blob bits. A corner counts only when both adjacent sides are set. */
export const BLOB = {
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128,
} as const;

/**
 * Godot 3×3 minimal template (`autotile_template_3x3_minimal`), 12×4.
 * Values are canonical blob masks: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128.
 * -1 is the unused cell at column 10, row 1 (index 22).
 * A cell's pixels start at (column * tileSize, row * tileSize).
 */
export const GODOT_BLOB_GRID: readonly (readonly number[])[] = [
  [16, 20, 84, 80, 213, 92, 116, 87, 28, 125, 124, 112],
  [17, 21, 85, 81, 29, 127, 253, 113, 31, 119, -1, 245],
  [1, 5, 69, 65, 23, 223, 247, 209, 95, 255, 221, 241],
  [0, 4, 68, 64, 117, 71, 197, 93, 7, 199, 215, 193],
];

const GODOT_CELL_BY_MASK = new Map<number, { column: number; row: number }>();
for (let row = 0; row < GODOT_BLOB_GRID.length; row += 1) {
  const line = GODOT_BLOB_GRID[row];
  for (let column = 0; column < line.length; column += 1) {
    const mask = line[column];
    if (mask < 0) continue;
    GODOT_CELL_BY_MASK.set(mask, { column, row });
  }
}

export function canonicalBlobMask(mask: number): number {
  const side = BLOB.N | BLOB.E | BLOB.S | BLOB.W;
  let canonical = mask & side;
  if ((mask & BLOB.NE) !== 0 && (mask & BLOB.N) !== 0 && (mask & BLOB.E) !== 0) canonical |= BLOB.NE;
  if ((mask & BLOB.SE) !== 0 && (mask & BLOB.S) !== 0 && (mask & BLOB.E) !== 0) canonical |= BLOB.SE;
  if ((mask & BLOB.SW) !== 0 && (mask & BLOB.S) !== 0 && (mask & BLOB.W) !== 0) canonical |= BLOB.SW;
  if ((mask & BLOB.NW) !== 0 && (mask & BLOB.N) !== 0 && (mask & BLOB.W) !== 0) canonical |= BLOB.NW;
  return canonical;
}

export function godotCellForMask(mask: number): { index: number; column: number; row: number } {
  const canonical = canonicalBlobMask(mask);
  const cell = GODOT_CELL_BY_MASK.get(canonical);
  if (!cell) throw new Error("Godot 47-Blob 템플릿에 없는 이웃입니다.");
  return {
    index: cell.row * GODOT_COLUMNS + cell.column,
    column: cell.column,
    row: cell.row,
  };
}

export function godotSourceRect(mask: number, tileSize: number) {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  const cell = godotCellForMask(mask);
  return {
    index: cell.index,
    x: cell.column * tileSize,
    y: cell.row * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

export function neighborsFromBlobMask(mask: number): Neighbors {
  const canonical = canonicalBlobMask(mask);
  const side = (bit: number): NeighborValue => ((canonical & bit) !== 0 ? 1 : 2);
  const corner = (bit: number, sideA: number, sideB: number): NeighborValue => {
    if ((canonical & sideA) === 0 || (canonical & sideB) === 0) return 0;
    return (canonical & bit) !== 0 ? 1 : 2;
  };
  return {
    Top: side(BLOB.N),
    Bottom: side(BLOB.S),
    Left: side(BLOB.W),
    Right: side(BLOB.E),
    TopLeft: corner(BLOB.NW, BLOB.N, BLOB.W),
    TopRight: corner(BLOB.NE, BLOB.N, BLOB.E),
    BottomLeft: corner(BLOB.SW, BLOB.S, BLOB.W),
    BottomRight: corner(BLOB.SE, BLOB.S, BLOB.E),
  };
}

const PRESET_SHAPES: readonly { preset: RulePreset; columns: number; rows: number }[] = [
  { preset: "15-tileset", columns: 3, rows: 5 },
  { preset: "15-tileset", columns: 4, rows: 4 },
  { preset: "15-tileset", columns: 4, rows: 8 },
  { preset: "godot-47", columns: 12, rows: 4 },
  { preset: "godot-47", columns: 24, rows: 8 },
  { preset: "wang", columns: 5, rows: 8 },
  { preset: "wang", columns: 5, rows: 4 },
];

/** Pick the PixelLab preset whose column:row ratio is closest to the uploaded sheet. */
export function detectPreset(width: number, height: number, tileSize: number): RulePreset | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (Number.isInteger(tileSize) && tileSize > 0 && width % tileSize === 0 && height % tileSize === 0) {
    const columns = width / tileSize;
    const rows = height / tileSize;
    const exact = PRESET_SHAPES.find((shape) => shape.columns === columns && shape.rows === rows);
    if (exact) return exact.preset;
    const taller = PRESET_SHAPES
      .filter((shape) => shape.columns === columns && rows >= shape.rows)
      .sort((a, b) => b.rows - a.rows);
    if (taller[0]) return taller[0].preset;
  }
  const ratio = width / height;
  let best: { preset: RulePreset; error: number } | null = null;
  for (const shape of PRESET_SHAPES) {
    const error = Math.abs(ratio - shape.columns / shape.rows);
    if (!best || error < best.error) best = { preset: shape.preset, error };
  }
  return best && best.error <= 0.08 ? best.preset : null;
}

export function suggestPreset(
  width: number,
  height: number,
  tileSize: number,
  current: RulePreset,
): RulePreset {
  const detected = detectPreset(width, height, tileSize);
  if (!detected || detected === current) return current;
  const currentFits = analyzeSheet({ width, height, tileSize, preset: current }).error === null;
  if (currentFits) return current;
  const detectedFits = analyzeSheet({ width, height, tileSize, preset: detected }).error === null;
  return detectedFits ? detected : current;
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
  /** Kept for the Unity builder. Current presets slice square cells, so this stays false. */
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

/** Role of a Wang 2-corner mask. Straight vertical edges are NW+SW and NE+SE. */
export function wangCornerLabel(mask: number): string {
  if (mask === 0) return "고립 단독";
  if (mask === 15) return "내부 바닥";
  if (mask === 5 || mask === 10) return "세로 벽";
  if (mask === 3 || mask === 12) return "가로 엣지";
  if (mask === 1 || mask === 2 || mask === 4 || mask === 8) return "바깥 코너";
  if (mask === 7 || mask === 11 || mask === 13 || mask === 14) return "안쪽 모서리";
  if (mask === 6 || mask === 9) return "대각";
  return "패턴";
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

function blobLabel(mask: number): string {
  const canonical = canonicalBlobMask(mask);
  if (canonical === 0) return "고립";
  if (canonical === GODOT_FULL_MASK) return "내부 바닥";
  const sides = [BLOB.N, BLOB.E, BLOB.S, BLOB.W].filter((bit) => (canonical & bit) !== 0).length;
  const corners = [BLOB.NE, BLOB.SE, BLOB.SW, BLOB.NW].filter((bit) => (canonical & bit) !== 0).length;
  if (sides === 1 && corners === 0) return "끝";
  if (sides === 2 && corners === 0) {
    const opposite = (canonical & BLOB.N) !== 0 && (canonical & BLOB.S) !== 0
      || (canonical & BLOB.E) !== 0 && (canonical & BLOB.W) !== 0;
    return opposite ? "직선 통로" : "바깥 코너";
  }
  if (corners > 0 && sides === 2) return "안쪽 코너";
  if (sides === 3) return "삼면";
  if (sides === 4) return corners === 4 ? "내부 바닥" : "오목 모서리";
  return "패턴";
}

function blobName(mask: number): string {
  const canonical = canonicalBlobMask(mask);
  if (canonical === 0) return "isolated";
  if (canonical === GODOT_FULL_MASK) return "floor";
  return `blob_${canonical.toString(16).padStart(2, "0")}`;
}

function fifteenSlots(shape: FifteenShape): Slot[] {
  return fifteenMasks(shape).map((mask, index) => ({
    index,
    mask,
    name: cornerName(mask),
    label: cornerLabel(mask),
    neighbors: neighborsFromCornerMask(mask),
    rule: mask !== 0,
    fallback: shape === "4x4" ? mask === 0 : mask === 15,
  }));
}

function godotSlots(): Slot[] {
  const seen = new Set<number>();
  const slots: Slot[] = [];
  for (let mask = 0; mask < 256; mask += 1) {
    const canonical = canonicalBlobMask(mask);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const cell = godotCellForMask(canonical);
    slots.push({
      index: cell.index,
      mask: canonical,
      name: blobName(canonical),
      label: blobLabel(canonical),
      neighbors: neighborsFromBlobMask(canonical),
      rule: true,
      fallback: canonical === GODOT_FULL_MASK,
    });
  }
  return slots;
}

function slotsForPreset(preset: RulePreset, shape: FifteenShape): Slot[] {
  if (preset === "godot-47") return godotSlots();
  if (preset === "wang") {
    throw new Error("Wang 슬롯은 시트 높이에 따라 wangSlots로 만듭니다.");
  }
  return fifteenSlots(shape);
}

function wangNeighbors(patch: Partial<Neighbors>): Neighbors {
  return { ...emptyNeighbors(), ...patch };
}

function wangInner(open: "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight"): Neighbors {
  const neighbors = neighborsFromCornerMask(15);
  neighbors[open] = 2;
  return neighbors;
}

function wangFixedSlot(
  index: number,
  name: string,
  label: string,
  mask: number,
  neighbors: Neighbors,
  fallback = false,
): Slot {
  return { index, mask, name, label, neighbors, rule: true, fallback };
}

/**
 * 5×8 rules in check order. Unity and the sandbox use the first match.
 * Do not sort this array. Narrow corridors, then outer corners, then straight
 * edges, then a single inner gap, then the full floor.
 * Cardinals on edges and corners are all specified. An inner corner keeps the
 * other seven neighbours filled so two gaps fall through to tile_16.
 * tile_13 is both the isolated cell and the bottom of a 1-wide vertical corridor.
 */
function wangFixedSlots(): Slot[] {
  const floor = neighborsFromCornerMask(15);
  return [
    wangFixedSlot(WANG_5X8_INDEX.single, "single", "고립 단독", 0, wangNeighbors({
      Top: 2, Bottom: 2, Left: 2, Right: 2,
    })),
    wangFixedSlot(WANG_5X8_INDEX.corridorNS, "corridor_ns", "세로 1칸 폭 통로", 5, wangNeighbors({
      Left: 2, Right: 2, Top: 1, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.corridorNSTop, "corridor_ns_top", "세로 1칸 통로 상단", 4, wangNeighbors({
      Left: 2, Right: 2, Top: 2, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.corridorNSBottom, "corridor_ns_bottom", "세로 1칸 통로 하단", 1, wangNeighbors({
      Left: 2, Right: 2, Top: 1, Bottom: 2,
    })),
    wangFixedSlot(WANG_5X8_INDEX.outerNW, "outer_nw", "북서 외곽 코너", 6, wangNeighbors({
      Top: 2, Left: 2, Right: 1, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.outerNE, "outer_ne", "북동 외곽 코너", 12, wangNeighbors({
      Top: 2, Right: 2, Left: 1, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.outerSW, "outer_sw", "남서 외곽 코너", 3, wangNeighbors({
      Bottom: 2, Left: 2, Right: 1, Top: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.outerSE, "outer_se", "남동 외곽 코너", 9, wangNeighbors({
      Bottom: 2, Right: 2, Left: 1, Top: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.north, "north", "북쪽 상단 테두리", 14, wangNeighbors({
      Top: 2, Bottom: 1, Left: 1, Right: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.south, "south", "남쪽 하단 테두리", 11, wangNeighbors({
      Bottom: 2, Top: 1, Left: 1, Right: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.west, "west", "서쪽 좌측 테두리", 7, wangNeighbors({
      Left: 2, Right: 1, Top: 1, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.east, "east", "동쪽 우측 테두리", 13, wangNeighbors({
      Right: 2, Left: 1, Top: 1, Bottom: 1,
    })),
    wangFixedSlot(WANG_5X8_INDEX.innerNW, "inner_nw", "북서 안쪽 코너", 15, wangInner("TopLeft")),
    wangFixedSlot(WANG_5X8_INDEX.innerNE, "inner_ne", "북동 안쪽 코너", 15, wangInner("TopRight")),
    wangFixedSlot(WANG_5X8_INDEX.innerSW, "inner_sw", "남서 안쪽 코너", 15, wangInner("BottomLeft")),
    wangFixedSlot(WANG_5X8_INDEX.innerSE, "inner_se", "남동 안쪽 코너", 15, wangInner("BottomRight")),
    wangFixedSlot(WANG_5X8_INDEX.floor, "floor", "내부 바닥", 15, floor, true),
  ];
}

function wangSlots(tall: boolean): Slot[] {
  if (tall) return wangFixedSlots();
  const slots: Slot[] = [];
  for (let mask = 0; mask <= 15; mask += 1) {
    const index = wangSurfaceIndex(mask, false);
    slots.push({
      index,
      mask,
      name: cornerName(mask),
      label: wangCornerLabel(mask),
      neighbors: mask === 0 ? emptyNeighbors() : actualFromCornerMask(mask),
      rule: mask !== 0,
      fallback: mask === 0,
    });
  }
  return slots;
}

function orderedRules(slots: Slot[], preserveOrder = false): RuleEntry[] {
  const entries = slots
    .filter((slot) => slot.rule)
    .map((slot) => ({
      index: slot.index,
      sprite: tileSpriteName(slot.index),
      name: slot.name,
      label: slot.label,
      mask: slot.mask,
      neighbors: cloneNeighbors(slot.neighbors),
    }));
  if (preserveOrder) return entries;
  return entries
    .map((rule) => ({
      rule,
      weight: countCondition(rule.neighbors, 1) * 10 + countCondition(rule.neighbors, 2),
    }))
    .sort((a, b) => b.weight - a.weight || a.rule.index - b.rule.index)
    .map(({ rule }) => rule);
}

/** Unity's first matching rule index, or null when the default sprite applies. */
export function wangMatchingIndex(actual: Neighbors, tall: boolean): number | null {
  return firstMatchingRule(orderedRules(wangSlots(tall), tall), actual);
}

/**
 * Rule sprite for this neighbourhood.
 * A 5×8 miss is tile_16. Wall graphics and empty cells are rejected.
 */
export function wangResolve(actual: Neighbors, tall: boolean): { index: number; mask: number } {
  const rules = orderedRules(wangSlots(tall), tall);
  for (const rule of rules) {
    if (!ruleMatches(rule.neighbors, actual)) continue;
    return tall ? guardWang5x8Sprite(rule.index, rule.mask) : { index: rule.index, mask: rule.mask };
  }
  if (tall) return { index: WANG_TALL_FLOOR_INDEX, mask: 15 };
  return { index: 0, mask: 0 };
}

function guardWang5x8Sprite(index: number, mask: number): { index: number; mask: number } {
  if (WANG_5X8_WALL_SET.has(index) || isWang5x8Black(index)) {
    return { index: WANG_TALL_FLOOR_INDEX, mask: 15 };
  }
  return { index, mask };
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

  const baseColumns = input.width / input.tileSize;
  const baseRows = input.height / input.tileSize;
  const preset = PRESET_INFO[input.preset];
  let sliceSize = input.tileSize;
  let columns = baseColumns;
  let rows = baseRows;
  let mappedRows = preset.rows;
  let shape: FifteenShape = "3x5";

  if (input.preset === "15-tileset") {
    const found = fifteenShape(baseColumns, baseRows);
    if (!found) {
      const cells = sliceSheet(input.width, input.height, input.tileSize);
      return {
        columns: baseColumns,
        rows: baseRows,
        cells,
        data: null,
        warning: null,
        error: `PixelLab 15-tileset은 3×5(15칸)입니다. 이 시트는 ${baseColumns}×${baseRows}칸입니다.`,
      };
    }
    shape = found;
    mappedRows = found === "3x5" ? FIFTEEN_ROWS : 4;
  } else if (input.preset === "godot-47") {
    const doubledSheet = baseColumns === GODOT_COLUMNS * 2 && baseRows >= GODOT_ROWS * 2
      && input.height % (input.tileSize * 2) === 0;
    if (doubledSheet) {
      sliceSize = input.tileSize * 2;
      columns = input.width / sliceSize;
      rows = input.height / sliceSize;
      mappedRows = GODOT_ROWS;
    } else if (baseColumns === GODOT_COLUMNS && baseRows >= GODOT_ROWS) {
      mappedRows = GODOT_ROWS;
    } else {
      const cells = sliceSheet(input.width, input.height, input.tileSize);
      return {
        columns: baseColumns,
        rows: baseRows,
        cells,
        data: null,
        warning: null,
        error: `PixelLab Godot 47-Blob은 12×4 템플릿이거나 기본 칸 24×8 시트입니다. 이 시트는 ${baseColumns}×${baseRows}칸입니다.`,
      };
    }
  } else if (baseColumns !== WANG_COLUMNS) {
    const cells = sliceSheet(input.width, input.height, input.tileSize);
    return {
      columns: baseColumns,
      rows: baseRows,
      cells,
      data: null,
      warning: null,
      error: `${preset.label} 프리셋은 가로 ${WANG_COLUMNS}칸입니다. 이 시트는 ${baseColumns}칸입니다.`,
    };
  } else if (baseRows !== WANG_LOGICAL_ROWS && baseRows < WANG_LOGICAL_ROWS * 2) {
    const cells = sliceSheet(input.width, input.height, input.tileSize);
    return {
      columns: baseColumns,
      rows: baseRows,
      cells,
      data: null,
      warning: null,
      error: `${preset.label} 프리셋은 세로 4칸(정사각) 또는 8칸(세로 2배)입니다. 현재 ${baseRows}칸입니다.`,
    };
  } else {
    mappedRows = wangMappedRows(baseRows);
  }

  const cells = sliceSheet(input.width, input.height, sliceSize);
  const base = { columns, rows, cells, data: null, warning: null };
  const tallWang = input.preset === "wang" && wangEdgeBand(mappedRows);
  const slots = input.preset === "wang" ? wangSlots(tallWang) : slotsForPreset(input.preset, shape);
  const slotByIndex = new Map<number, Slot>();
  for (const slot of slots) {
    if (!slotByIndex.has(slot.index)) slotByIndex.set(slot.index, slot);
  }
  const fallback = slots.find((slot) => slot.fallback);
  if (!fallback) {
    return { ...base, error: "프리셋에 기본 스프라이트가 없습니다." };
  }

  const mappedCells: RuleCell[] = cells.map((cell) => {
    const slot = slotByIndex.get(cell.index);
    if (!slot || cell.row >= mappedRows) {
      const inside = cell.row < mappedRows;
      const black = tallWang && inside && isWang5x8Black(cell.index);
      return {
        ...cell,
        sprite: tileSpriteName(cell.index),
        name: black ? "black" : "unmapped",
        label: black ? "검은 빈칸" : tallWang && inside ? "미사용" : "범위 밖",
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

  const rules = orderedRules(slots, tallWang);

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
      tileSize: sliceSize,
      image: "Tileset.png",
      columns,
      rows,
      doubleHeight: false,
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
// A 5x8 Wang sheet checks rules in this fixed order, first match wins:
// 1. isolated tile and 1-wide vertical corridors
// 2. outer corners
// 3. straight edges (all four cardinals specified)
// 4. one inner diagonal gap
// 5. full floor. Anything else uses the default sprite, also tile_16.
// 15-tileset rules mark the three cells around each filled corner as This and leave
// the rest Ignore, with stricter rules first.
// PixelLab 15-tileset is 3 columns by 5 rows (indices 0-14). A native 4x4 or 4x8
// sheet is accepted too and keeps the 16-role order.
// Wang sheets are 5 columns of square cells. On a 5x4 sheet the index is the mask
// (NW + 2*NE + 4*SW + 8*SE), so tile 15 is the floor and tile 0 is the default.
// A 5x8 sheet (160x256, 40 cells) uses the fixed index table below. The builder
// rebinds those rule names onto these sprites and refuses the empty cells.
//   floor / default sprite          tile_16
//   single / corridor bottom        tile_13
//   vertical corridor               tile_08
//   vertical corridor top           tile_03
//   north / south / west / east     tile_11, tile_21, tile_15, tile_17
//   outer NW / NE / SW / SE         tile_10, tile_12, tile_20, tile_22
//   inner NW / NE / SW / SE         tile_24, tile_23, tile_29, tile_28
//   black, never a rule             tile_31 tile_32 tile_33 tile_34 tile_36 tile_37 tile_38 tile_39
// tile_00, tile_01, tile_02 and tile_05, tile_06, tile_07 are the north wall
// header and pillar faces. They are not terrain rules.
// doubleHeight stays false; each rule samples one square cell.
// Godot 47-blob is the fixed 12x4 3x3-minimal template (47 rules). A cell's pixels
// are column * tileSize, row * tileSize. A PixelLab Godot download that is 24x8
// base cells is sliced as that template at twice the tile size.
// Each rule sets the four sides to This or NotThis. A diagonal is This or NotThis
// only when both adjacent sides are This; otherwise the corner is Ignore.
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
                "Rule Tile을 만들었습니다.\\n" + assetPath + "\\n룰 " + ruleTile.m_TilingRules.Count + "개, 기본 스프라이트 tile_" + DefaultSpriteIndex(data).ToString("00"),
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

    private static bool IsWang5x8(SpriteForgeRuleData data)
    {
        return data != null && data.preset == "wang" && data.columns == 5 && data.rows >= 8;
    }

    private static int DefaultSpriteIndex(SpriteForgeRuleData data)
    {
        if (IsWang5x8(data)) return 16;
        return data.defaultSpriteIndex;
    }

    private static bool IsWang5x8Black(int index)
    {
        return index == 31 || index == 32 || index == 33 || index == 34
            || index == 36 || index == 37 || index == 38 || index == 39;
    }

    private static int BindWang5x8Index(string name)
    {
        switch (name)
        {
            case "floor": return 16;
            case "north": return 11;
            case "south": return 21;
            case "west": return 15;
            case "east": return 17;
            case "outer_nw": return 10;
            case "outer_ne": return 12;
            case "outer_sw": return 20;
            case "outer_se": return 22;
            case "inner_nw": return 24;
            case "inner_ne": return 23;
            case "inner_sw": return 29;
            case "inner_se": return 28;
            case "single": return 13;
            case "corridor_ns": return 8;
            case "corridor_ns_top": return 3;
            case "corridor_ns_bottom": return 13;
            default: return -1;
        }
    }

    private static RuleTile CreateRuleTile(SpriteForgeRuleData data, Dictionary<string, Sprite> sprites)
    {
        var ruleTile = ScriptableObject.CreateInstance<RuleTile>();
        ruleTile.m_DefaultSprite = RequireSprite(sprites, DefaultSpriteIndex(data));
        ruleTile.m_DefaultColliderType = Tile.ColliderType.Sprite;

        var id = 0;
        foreach (var entry in data.rules)
        {
            if (entry == null || entry.neighbors == null)
            {
                throw new InvalidOperationException("RuleData.json 룰에 neighbors 가 없습니다.");
            }

            var index = entry.index;
            if (IsWang5x8(data))
            {
                var forced = BindWang5x8Index(entry.name);
                if (forced >= 0) index = forced;
                if (IsWang5x8Black(index)) continue;
            }

            var rule = new RuleTile.TilingRule();
            rule.m_Id = id++;
            rule.m_Output = RuleTile.TilingRuleOutput.OutputSprite.Single;
            rule.m_ColliderType = Tile.ColliderType.Sprite;
            rule.m_RuleTransform = RuleTile.TilingRuleOutput.Transform.Fixed;
            rule.m_Sprites[0] = RequireSprite(sprites, index);
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
