export const TILE_SIZES = [16, 24, 32, 48, 64] as const;

/** Keep the trimmed sprite's own pixel size instead of fitting a square tile. */
export const ORIGINAL_TILE_SIZE = "original" as const;

export type TileSize = (typeof TILE_SIZES)[number] | typeof ORIGINAL_TILE_SIZE;

export type PackSettings = {
  tileSize: TileSize;
  trimAlpha: boolean;
  padding: number;
  pixelated: boolean;
  /** Expand each atlas edge to the next power of two that still contains the packed sprites. */
  forcePowerOfTwo: boolean;
};

export const DEFAULT_SETTINGS: PackSettings = {
  tileSize: 64,
  trimAlpha: true,
  padding: 1,
  pixelated: false,
  forcePowerOfTwo: true,
};

export type SpriteRect = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AtlasDocument = {
  app: "SpriteForge";
  version: 1;
  image: "Atlas.png";
  width: number;
  height: number;
  /** Square tile edge, or 0 when sprites keep their trimmed original size. */
  tileSize: number;
  padding: number;
  trimAlpha: boolean;
  pixelated: boolean;
  forcePowerOfTwo: boolean;
  sprites: SpriteRect[];
};

export type PackResult = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  sprites: SpriteRect[];
  fill: number;
};

export type SpriteStatus = "queued" | "ready" | "empty" | "error";

export type SpriteRecord = {
  id: string;
  file: File;
  status: SpriteStatus;
  spriteName: string;
  previewUrl?: string;
  message?: string;
  sourceWidth?: number;
  sourceHeight?: number;
};
