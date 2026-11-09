import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeDownloadName, sanitizeStem, uniqueFileNames } from "./fileNames.ts";

test("file stems drop characters outside the safe set", () => {
  assert.equal(sanitizeStem("Hero Attack.png"), "Hero_Attack");
  assert.equal(sanitizeStem("주인공.png"), "");
  assert.equal(sanitizeStem("../secret.png"), "secret");
  assert.equal(sanitizeStem("a/b:c.png"), "bc");
  assert.equal(sanitizeDownloadName("hero@walk.jpg"), "herowalk.jpg");
  assert.equal(sanitizeDownloadName("주인공.svg"), "sprite.png");
  assert.equal(sanitizeDownloadName("..\\evil.webp"), "evil.webp");
});

test("duplicate cleaned png names keep their extension", () => {
  assert.deepEqual(uniqueFileNames(["slime.png", "bat.png", "slime.png"]), [
    "slime.png",
    "bat.png",
    "slime_2.png",
  ]);
});
