import assert from "node:assert/strict";
import { test } from "node:test";
import { uniqueFileNames } from "./fileNames.ts";

test("duplicate cleaned png names keep their extension", () => {
  assert.deepEqual(uniqueFileNames(["slime.png", "bat.png", "slime.png"]), [
    "slime.png",
    "bat.png",
    "slime_2.png",
  ]);
});
