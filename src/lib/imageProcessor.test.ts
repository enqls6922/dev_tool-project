import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAtlasDocument,
  clampPadding,
  cleanGhostPixels,
  extrudeClampBleed,
  findOpaqueBounds,
  generateUnityImporterScript,
  layoutFrames,
  layoutSprites,
  nextPowerOfTwoEdge,
  toSpriteName,
  uniqueSpriteNames,
} from "./imageProcessor.ts";
import { DEFAULT_SETTINGS } from "./types.ts";

test("findOpaqueBounds ignores fully transparent pixels and keeps alpha 1", () => {
  const width = 6;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const paint = (x: number, y: number, alpha: number) => {
    const index = (y * width + x) * 4;
    pixels[index] = 200;
    pixels[index + 1] = 20;
    pixels[index + 2] = 20;
    pixels[index + 3] = alpha;
  };
  paint(1, 1, 0);
  paint(2, 2, 1);
  paint(4, 3, 255);
  assert.deepEqual(findOpaqueBounds(pixels, width, height), {
    x: 2,
    y: 2,
    width: 3,
    height: 2,
  });
});

test("findOpaqueBounds returns null for an empty buffer", () => {
  assert.equal(findOpaqueBounds(new Uint8ClampedArray(32), 4, 2), null);
});

test("cleanGhostPixels zeroes rgba when alpha is between 1 and 29", () => {
  const pixels = new Uint8ClampedArray([
    1, 2, 3, 0,
    4, 5, 6, 1,
    7, 8, 9, 29,
    10, 11, 12, 30,
    13, 14, 15, 255,
  ]);
  assert.equal(cleanGhostPixels(pixels), 2);
  assert.deepEqual(Array.from(pixels), [
    1, 2, 3, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    10, 11, 12, 30,
    13, 14, 15, 255,
  ]);
});

test("cleanGhostPixels ignores a short trailing channel", () => {
  const pixels = new Uint8ClampedArray([9, 9, 9, 12, 1, 2]);
  assert.equal(cleanGhostPixels(pixels), 1);
  assert.equal(pixels[0], 0);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[4], 1);
});

test("1px bleed clamp-copies edges and corners", () => {
  const pixels = new Uint8ClampedArray([
    1, 0, 0, 255, 2, 0, 0, 255,
    3, 0, 0, 255, 4, 0, 0, 200,
  ]);
  const out = extrudeClampBleed(pixels, 2, 2);
  assert.equal(out.length, 4 * 4 * 4);
  const texel = (x: number, y: number) => {
    const index = (y * 4 + x) * 4;
    return [out[index], out[index + 3]];
  };
  assert.deepEqual(texel(0, 0), [1, 255]);
  assert.deepEqual(texel(3, 0), [2, 255]);
  assert.deepEqual(texel(0, 3), [3, 255]);
  assert.deepEqual(texel(3, 3), [4, 200]);
  assert.deepEqual(texel(1, 0), [1, 255]);
  assert.deepEqual(texel(2, 1), [2, 255]);
  assert.deepEqual(texel(1, 1), [1, 255]);
  assert.deepEqual(texel(2, 2), [4, 200]);
});

test("sprite names stay readable, unique, and free of special characters", () => {
  assert.equal(toSpriteName("Hero Attack.png"), "Hero_Attack");
  assert.equal(toSpriteName("주인공.png"), "sprite");
  assert.equal(toSpriteName("hero@attack.png"), "hero_attack");
  assert.equal(toSpriteName("../Hero.png"), "Hero");
  assert.equal(toSpriteName(".png"), "sprite");
  assert.equal(toSpriteName(`hero"; System.Console.WriteLine("x").png`), "hero_System_Console_WriteLine_x");
  assert.deepEqual(uniqueSpriteNames(["slime", "slime", "bat", "slime"]), [
    "slime",
    "slime_2",
    "bat",
    "slime_3",
  ]);
});

test("padding is clamped to the 0..4 slider range", () => {
  assert.equal(clampPadding(1.4), 1);
  assert.equal(clampPadding(-3), 0);
  assert.equal(clampPadding(9), 4);
});

test("potpack keeps tiles inside the atlas, separated by padding, without a trailing gutter", () => {
  const layout = layoutSprites(
    Array.from({ length: 5 }, (_, index) => ({ name: `s${index}` })),
    64,
    1,
  );

  assert.equal(layout.sprites.length, 5);
  assert.ok(layout.fill > 0 && layout.fill <= 1);

  for (let i = 0; i < layout.sprites.length; i += 1) {
    const sprite = layout.sprites[i];
    assert.equal(sprite.width, 64);
    assert.equal(sprite.height, 64);
    assert.ok(sprite.x >= 0 && sprite.y >= 0);
    assert.ok(sprite.x + sprite.width <= layout.width);
    assert.ok(sprite.y + sprite.height <= layout.height);

    for (let j = i + 1; j < layout.sprites.length; j += 1) {
      const other = layout.sprites[j];
      const overlapsX = sprite.x < other.x + other.width && other.x < sprite.x + sprite.width;
      const overlapsY = sprite.y < other.y + other.height && other.y < sprite.y + sprite.height;
      assert.equal(overlapsX && overlapsY, false);
      if (overlapsY) {
        const gap = sprite.x <= other.x
          ? other.x - (sprite.x + sprite.width)
          : sprite.x - (other.x + other.width);
        assert.ok(gap >= 1);
      }
      if (overlapsX) {
        const gap = sprite.y <= other.y
          ? other.y - (sprite.y + sprite.height)
          : sprite.y - (other.y + other.height);
        assert.ok(gap >= 1);
      }
    }
  }
});

test("a single tile does not grow by the padding gutter", () => {
  const layout = layoutSprites([{ name: "only" }], 32, 4);
  assert.deepEqual(
    layout.sprites.map(({ name, x, y, width, height }) => ({ name, x, y, width, height })),
    [{ name: "only", x: 0, y: 0, width: 32, height: 32 }],
  );
  assert.equal(layout.width, 32);
  assert.equal(layout.height, 32);
});

test("unity importer flips top-left json into bottom-left sprite rects", () => {
  const script = generateUnityImporterScript();
  assert.equal(script, generateUnityImporterScript());
  assert.doesNotMatch(script, /\$\{/);
  assert.match(script, /MenuItem\("Tools\/SpriteForge\/Slice Selected Atlas"\)/);
  assert.match(script, /atlasData\.height - sprite\.y - sprite\.height/);
  assert.match(script, /JsonUtility\.FromJson<AtlasFile>/);
  assert.match(script, /SpriteImportMode\.Multiple/);
  assert.match(script, /Atlas\.json/);
  assert.match(
    script,
    /textureImporter\.spritePixelsPerUnit = atlasData\.tileSize > 0 \? atlasData\.tileSize : 32;/,
  );
  assert.match(script, /textureImporter\.filterMode = FilterMode\.Point;/);
  assert.match(script, /textureImporter\.textureCompression = TextureImporterCompression\.Uncompressed;/);
  assert.match(script, /textureImporter\.mipmapEnabled = false;/);
});

test("power-of-two edges round up to the smallest size that still fits", () => {
  assert.equal(nextPowerOfTwoEdge(1), 16);
  assert.equal(nextPowerOfTwoEdge(16), 16);
  assert.equal(nextPowerOfTwoEdge(17), 32);
  assert.equal(nextPowerOfTwoEdge(24), 32);
  assert.equal(nextPowerOfTwoEdge(48), 64);
  assert.equal(nextPowerOfTwoEdge(2048), 2048);
  assert.equal(nextPowerOfTwoEdge(2049), 4096);
  assert.equal(nextPowerOfTwoEdge(8192), 8192);
  assert.throws(() => nextPowerOfTwoEdge(8193), /8192/);
});

test("force power of two expands the canvas without moving sprites", () => {
  const tight = layoutSprites(
    Array.from({ length: 5 }, (_, index) => ({ name: `s${index}` })),
    64,
    1,
  );
  const expanded = layoutSprites(
    Array.from({ length: 5 }, (_, index) => ({ name: `s${index}` })),
    64,
    1,
    true,
  );

  assert.equal(expanded.width, nextPowerOfTwoEdge(tight.width));
  assert.equal(expanded.height, nextPowerOfTwoEdge(tight.height));
  assert.deepEqual(
    expanded.sprites.map(({ name, x, y, width, height }) => ({ name, x, y, width, height })),
    tight.sprites.map(({ name, x, y, width, height }) => ({ name, x, y, width, height })),
  );
  assert.ok(expanded.width >= tight.width && expanded.height >= tight.height);
  assert.ok(expanded.fill <= tight.fill);
});

test("original frames keep their own size and only grow the atlas when power of two is on", () => {
  const frames = [
    { name: "hero", width: 24, height: 40 },
    { name: "coin", width: 18, height: 18 },
  ];
  const tight = layoutFrames(frames, 1, false);
  assert.equal(tight.sprites[0]?.width, 24);
  assert.equal(tight.sprites[0]?.height, 40);
  assert.equal(tight.sprites[1]?.width, 18);
  assert.equal(tight.sprites[1]?.height, 18);
  assert.ok(tight.width < 64 || tight.height < 64);

  const expanded = layoutFrames(frames, 1, true);
  assert.equal(expanded.width, nextPowerOfTwoEdge(tight.width));
  assert.equal(expanded.height, nextPowerOfTwoEdge(tight.height));
  for (const sprite of expanded.sprites) {
    assert.ok(sprite.x + sprite.width <= expanded.width);
    assert.ok(sprite.y + sprite.height <= expanded.height);
  }

  const single = layoutFrames([{ name: "slash", width: 24, height: 40 }], 0, true);
  assert.deepEqual(
    { x: single.sprites[0]?.x, y: single.sprites[0]?.y, width: single.width, height: single.height },
    { x: 0, y: 0, width: 32, height: 64 },
  );
});

test("original tile size is written as 0 so Unity falls back to 32 pixels per unit", () => {
  const document = buildAtlasDocument(
    {
      canvas: {} as HTMLCanvasElement,
      width: 32,
      height: 64,
      fill: 0.5,
      sprites: [{ name: "slash", x: 0, y: 0, width: 24, height: 40 }],
    },
    { ...DEFAULT_SETTINGS, tileSize: "original", forcePowerOfTwo: true },
  );
  assert.equal(document.tileSize, 0);
  assert.equal(document.forcePowerOfTwo, true);
  assert.equal(document.bleed, 0);
  assert.equal(document.width, 32);
  assert.equal(document.height, 64);
});

test("atlas metadata keeps hostile sprite names out of the static importer", () => {
  const injected = `hero"; System.Diagnostics.Process.Start("calc")`;
  const document = buildAtlasDocument(
    {
      canvas: {} as HTMLCanvasElement,
      width: 16,
      height: 16,
      fill: 1,
      sprites: [{ name: injected, x: 0, y: 0, width: 8, height: 8 }],
    },
    DEFAULT_SETTINGS,
  );
  const script = generateUnityImporterScript();
  assert.equal(document.sprites[0]?.name, "hero_System_Diagnostics_Process_Start_calc");
  assert.doesNotMatch(script, /Process\.Start/);
  assert.doesNotMatch(script, /hero"/);
  assert.equal(JSON.parse(JSON.stringify(document)).sprites[0].name, document.sprites[0]?.name);
});
