import potpack, { type PotpackBox } from "potpack";
import type { AtlasDocument, PackResult, PackSettings, SpriteRect } from "./types";

export const MAX_IMAGE_EDGE = 8192;
export const MAX_ATLAS_EDGE = 8192;

const OPAQUE_ALPHA = 0;

export type OpaqueBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampPadding(padding: number): number {
  if (!Number.isFinite(padding)) return 1;
  return Math.min(4, Math.max(0, Math.round(padding)));
}

export function isPngFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/png") return true;
  if (type && type !== "application/octet-stream") return false;
  return file.name.toLowerCase().endsWith(".png");
}

export function toSpriteName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").normalize("NFKC");
  const cleaned = base
    .replace(/[\\/:*?"<>|#]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const clipped = cleaned.slice(0, 80);
  return clipped.length > 0 ? clipped : "sprite";
}

export function uniqueSpriteNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    return `${name}_${count + 1}`;
  });
}

/**
 * Scan an RGBA buffer and return the inclusive bounding box of pixels whose
 * alpha is above `alphaThreshold`. A threshold of 0 keeps every visible texel,
 * including antialiased edges, and drops only fully transparent padding.
 */
export function findOpaqueBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = OPAQUE_ALPHA,
): OpaqueBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3] <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function requireContext(
  canvas: HTMLCanvasElement,
  willReadFrequently = false,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", willReadFrequently ? { willReadFrequently: true } : undefined);
  if (!context) {
    throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
  }
  return context;
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} 을(를) PNG로 디코딩하지 못했습니다.`));
    };
    image.src = url;
  });
}

function rasterize(img: HTMLImageElement): { canvas: HTMLCanvasElement; bounds: OpaqueBounds | null } {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = requireContext(canvas, true);
  if (width > 0 && height > 0) {
    context.drawImage(img, 0, 0);
  }
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    canvas,
    bounds: findOpaqueBounds(imageData.data, canvas.width, canvas.height),
  };
}

function cropCanvas(source: HTMLCanvasElement, bounds: OpaqueBounds): HTMLCanvasElement {
  const cropped = document.createElement("canvas");
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  const context = requireContext(cropped);
  context.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  return cropped;
}

/** Scan alpha and return a canvas containing only the opaque bounding box. */
export function trimTransparentPixels(img: HTMLImageElement): HTMLCanvasElement {
  const { canvas, bounds } = rasterize(img);
  if (!bounds) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }
  return cropCanvas(canvas, bounds);
}

/** Center `trimmedCanvas` on a square tile, preserving aspect ratio. */
export function fitToSquare(
  trimmedCanvas: HTMLCanvasElement,
  targetSize: number,
  options?: { smoothing?: boolean },
): HTMLCanvasElement {
  if (!Number.isInteger(targetSize) || targetSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }

  const out = document.createElement("canvas");
  out.width = targetSize;
  out.height = targetSize;
  const context = requireContext(out);
  const sourceWidth = trimmedCanvas.width;
  const sourceHeight = trimmedCanvas.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) return out;

  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight);
  let drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  let drawHeight = Math.max(1, Math.round(sourceHeight * scale));
  if (drawWidth > targetSize) drawWidth = targetSize;
  if (drawHeight > targetSize) drawHeight = targetSize;

  const dx = Math.floor((targetSize - drawWidth) / 2);
  const dy = Math.floor((targetSize - drawHeight) / 2);
  const smoothing = options?.smoothing ?? true;
  context.imageSmoothingEnabled = smoothing;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, targetSize, targetSize);
  context.drawImage(trimmedCanvas, dx, dy, drawWidth, drawHeight);
  return out;
}

export type NormalizedSprite = {
  canvas: HTMLCanvasElement;
  empty: boolean;
  previewUrl: string;
  sourceWidth: number;
  sourceHeight: number;
};

export async function normalizeSprite(file: File, settings: PackSettings): Promise<NormalizedSprite> {
  const image = await loadImage(file);
  if (image.naturalWidth > MAX_IMAGE_EDGE || image.naturalHeight > MAX_IMAGE_EDGE) {
    throw new Error(`한 변이 ${MAX_IMAGE_EDGE}px를 넘습니다.`);
  }

  const surface = rasterize(image);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!surface.bounds) {
    const blank = document.createElement("canvas");
    blank.width = settings.tileSize;
    blank.height = settings.tileSize;
    return {
      canvas: blank,
      empty: true,
      previewUrl: blank.toDataURL("image/png"),
      sourceWidth,
      sourceHeight,
    };
  }

  const content = settings.trimAlpha ? cropCanvas(surface.canvas, surface.bounds) : surface.canvas;
  const fitted = fitToSquare(content, settings.tileSize, { smoothing: !settings.pixelated });
  return {
    canvas: fitted,
    empty: false,
    previewUrl: fitted.toDataURL("image/png"),
    sourceWidth,
    sourceHeight,
  };
}

export function layoutSprites<T extends { name: string }>(
  items: readonly T[],
  tileSize: number,
  padding: number,
): {
  width: number;
  height: number;
  fill: number;
  sprites: Array<T & SpriteRect>;
} {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    throw new Error("타일 크기는 양의 정수여야 합니다.");
  }
  if (items.length === 0) {
    return { width: 0, height: 0, fill: 0, sprites: [] };
  }

  const gap = clampPadding(padding);
  const boxes: Array<PotpackBox & { item: T }> = items.map((item) => ({
    item,
    w: tileSize + gap,
    h: tileSize + gap,
  }));
  const stats = potpack(boxes);
  if (stats.w <= 0 || stats.h <= 0) {
    throw new Error("패킹 결과가 비어 있습니다.");
  }

  const sprites = boxes.map((box) => ({
    ...box.item,
    name: box.item.name,
    x: box.x ?? 0,
    y: box.y ?? 0,
    width: tileSize,
    height: tileSize,
  }));
  const width = sprites.reduce((max, sprite) => Math.max(max, sprite.x + sprite.width), 0);
  const height = sprites.reduce((max, sprite) => Math.max(max, sprite.y + sprite.height), 0);
  const fill = (sprites.length * tileSize * tileSize) / (width * height);
  return { width, height, fill, sprites };
}

/** Pack already-squared canvases into one atlas. Padding sits between tiles, not after the last edge. */
export function packSprites(
  processedCanvases: { name: string; canvas: HTMLCanvasElement }[],
  padding: number,
): PackResult {
  if (processedCanvases.length === 0) {
    throw new Error("패킹할 스프라이트가 없습니다.");
  }

  const tileSize = processedCanvases[0].canvas.width;
  for (const sprite of processedCanvases) {
    if (sprite.canvas.width !== tileSize || sprite.canvas.height !== tileSize) {
      throw new Error("모든 타일은 같은 정사각형 크기여야 합니다.");
    }
  }

  const layout = layoutSprites(processedCanvases, tileSize, padding);
  if (layout.width > MAX_ATLAS_EDGE || layout.height > MAX_ATLAS_EDGE) {
    throw new Error(
      `아틀라스가 ${layout.width}×${layout.height}px라서 브라우저 한도 ${MAX_ATLAS_EDGE}px를 넘습니다. 타일을 줄이거나 이미지를 덜어내세요.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = requireContext(canvas);
  context.imageSmoothingEnabled = false;
  for (const sprite of layout.sprites) {
    context.drawImage(sprite.canvas, sprite.x, sprite.y);
  }

  return {
    canvas,
    width: layout.width,
    height: layout.height,
    fill: layout.fill,
    sprites: layout.sprites.map(({ name, x, y, width, height }) => ({
      name,
      x,
      y,
      width,
      height,
    })),
  };
}

export function buildAtlasDocument(pack: PackResult, settings: PackSettings): AtlasDocument {
  return {
    app: "SpriteForge",
    version: 1,
    image: "Atlas.png",
    width: pack.width,
    height: pack.height,
    tileSize: settings.tileSize,
    padding: clampPadding(settings.padding),
    trimAlpha: settings.trimAlpha,
    pixelated: settings.pixelated,
    sprites: pack.sprites.map(({ name, x, y, width, height }) => ({
      name,
      x,
      y,
      width,
      height,
    })),
  };
}

/**
 * Unity editor script. JSON coordinates are top-left; Unity sprite rects are
 * bottom-left, so the importer flips Y with `height - y - spriteHeight`.
 * Requires Unity 2021.2 or newer.
 */
export function generateUnityImporterScript(): string {
  return `// SpriteForge — drop this file in an Editor folder (the zip already does).
// Select Atlas.png, then run Tools/SpriteForge/Slice Selected Atlas.
// Requires Unity 2021.2+.
#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class SpriteSheetImporter
{
    [MenuItem("Tools/SpriteForge/Slice Selected Atlas")]
    public static void SliceSelectedAtlas()
    {
        var textures = Selection.GetFiltered<Texture2D>(SelectionMode.Assets);
        if (textures.Length == 0)
        {
            EditorUtility.DisplayDialog("SpriteForge", "Project 창에서 Atlas.png 를 선택한 뒤 다시 실행하세요.", "확인");
            return;
        }

        var sliced = 0;
        foreach (var texture in textures)
        {
            if (SliceTexture(texture)) sliced++;
        }

        if (sliced == 0)
        {
            EditorUtility.DisplayDialog(
                "SpriteForge",
                "선택한 텍스처 옆에 Atlas.json 이 없거나 스프라이트 목록이 비어 있습니다.",
                "확인");
        }
    }

    private static bool SliceTexture(Texture2D texture)
    {
        var texturePath = AssetDatabase.GetAssetPath(texture);
        var directory = Path.GetDirectoryName(texturePath);
        var jsonPath = Path.Combine(directory ?? string.Empty, "Atlas.json");
        if (!File.Exists(jsonPath)) return false;

        var atlas = JsonUtility.FromJson<AtlasFile>(File.ReadAllText(jsonPath));
        if (atlas == null || atlas.sprites == null || atlas.sprites.Length == 0) return false;

        var importer = AssetImporter.GetAtPath(texturePath) as TextureImporter;
        if (importer == null) return false;

        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.alphaIsTransparency = true;
        importer.mipmapEnabled = false;
        importer.npotScale = TextureImporterNPOTScale.None;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.filterMode = atlas.pixelated ? FilterMode.Point : FilterMode.Bilinear;
        importer.spritePixelsPerUnit = atlas.tileSize > 0 ? atlas.tileSize : 100f;
        importer.maxTextureSize = 8192;
        importer.SaveAndReimport();

        var factories = new SpriteDataProviderFactories();
        factories.Init();
        var dataProvider = factories.GetSpriteEditorDataProviderFromObject(importer);
        dataProvider.InitSpriteEditorDataProvider();

        var rects = new SpriteRect[atlas.sprites.Length];
        var pairs = new SpriteNameFileIdPair[atlas.sprites.Length];
        for (var i = 0; i < atlas.sprites.Length; i++)
        {
            var sprite = atlas.sprites[i];
            var unityY = atlas.height - sprite.y - sprite.height;
            var spriteId = GUID.Generate();
            var name = string.IsNullOrWhiteSpace(sprite.name) ? "sprite_" + i : sprite.name;
            rects[i] = new SpriteRect
            {
                name = name,
                spriteID = spriteId,
                rect = new Rect(sprite.x, unityY, sprite.width, sprite.height),
                alignment = SpriteAlignment.Center,
                pivot = new Vector2(0.5f, 0.5f),
                border = Vector4.zero
            };
            pairs[i] = new SpriteNameFileIdPair(name, spriteId);
        }

        dataProvider.SetSpriteRects(rects);
        var nameFileIdProvider = dataProvider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        if (nameFileIdProvider != null)
        {
            nameFileIdProvider.SetNameFileIdPairs(pairs);
        }

        dataProvider.Apply();
        importer.SaveAndReimport();
        Debug.Log("SpriteForge sliced " + rects.Length + " sprites on " + texturePath + ".");
        return true;
    }
}

[System.Serializable]
public class AtlasFile
{
    public int width;
    public int height;
    public int tileSize;
    public bool pixelated;
    public SpriteEntry[] sprites;
}

[System.Serializable]
public class SpriteEntry
{
    public string name;
    public int x;
    public int y;
    public int width;
    public int height;
}
#endif
`;
}
