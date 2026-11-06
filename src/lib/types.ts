export const TILE_SIZES = [16, 32, 64, 128] as const;

export type TileSize = (typeof TILE_SIZES)[number];

export type PackSettings = {
  tileSize: TileSize;
  trimAlpha: boolean;
  padding: number;
  pixelated: boolean;
};

export const DEFAULT_SETTINGS: PackSettings = {
  tileSize: 64,
  trimAlpha: true,
  padding: 1,
  pixelated: false,
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
  tileSize: number;
  padding: number;
  trimAlpha: boolean;
  pixelated: boolean;
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
