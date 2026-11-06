import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampPadding,
  findOpaqueBounds,
  generateUnityImporterScript,
  layoutSprites,
  toSpriteName,
  uniqueSpriteNames,
} from "./imageProcessor.ts";

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

test("sprite names stay readable and unique", () => {
  assert.equal(toSpriteName("Hero Attack.png"), "Hero_Attack");
  assert.equal(toSpriteName("주인공.png"), "주인공");
  assert.equal(toSpriteName(".png"), "sprite");
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
  assert.match(script, /MenuItem\("Tools\/SpriteForge\/Slice Selected Atlas"\)/);
  assert.match(script, /atlas\.height - sprite\.y - sprite\.height/);
  assert.match(script, /JsonUtility\.FromJson<AtlasFile>/);
  assert.match(script, /SpriteImportMode\.Multiple/);
  assert.match(script, /Atlas\.json/);
});
