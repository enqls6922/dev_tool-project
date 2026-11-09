import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeFilename, sanitizeSpriteName, toPngDownloadName, uniqueFileNames } from "./fileNames.ts";

test("sanitizeFilename keeps the filename allowlist and flattens paths", () => {
  assert.equal(sanitizeFilename("Hero-01_walk.png"), "Hero-01_walk.png");
  assert.equal(sanitizeFilename("Hero Attack.png"), "Hero_Attack.png");
  assert.equal(sanitizeFilename(`hero"; <evil>.png`), "hero_evil.png");
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("..\\..\\Sprite.cs"), "Sprite.cs");
  assert.equal(sanitizeFilename("foo/bar.png"), "bar.png");
  assert.equal(sanitizeFilename("주인공.png"), "file.png");
  assert.equal(sanitizeFilename(""), "file");
  assert.equal(sanitizeSpriteName(`tile"; name`), "tile_name");
  assert.equal(toPngDownloadName(`shot".jpeg`), "shot.png");
});

test("duplicate cleaned png names keep their extension", () => {
  assert.deepEqual(uniqueFileNames(["slime.png", "bat.png", "slime.png"]), [
    "slime.png",
    "bat.png",
    "slime_2.png",
  ]);
});
