import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAnimationClipScript,
  buildFrameData,
  layoutFrameStrip,
  moveItem,
  normalizeSequenceFps,
} from "./frameSequencer.ts";

test("a strip is one row, bottom-aligned, and centered in each cell", () => {
  const layout = layoutFrameStrip([
    { width: 10, height: 20 },
    { width: 16, height: 8 },
  ]);
  assert.equal(layout.frameCount, 2);
  assert.equal(layout.width, 16);
  assert.equal(layout.height, 20);
  assert.equal(layout.sheetWidth, 32);
  assert.equal(layout.sheetHeight, 20);
  assert.deepEqual(layout.placements[0], { index: 0, x: 3, y: 0 });
  assert.deepEqual(layout.placements[1], { index: 1, x: 16, y: 12 });
});

test("frame data records count, resolution, and fps without a user file name", () => {
  const layout = layoutFrameStrip([{ width: 32, height: 48 }]);
  const data = buildFrameData(layout, 12);
  assert.deepEqual(data, {
    app: "SpriteForge",
    version: 1,
    kind: "frame-sequence",
    image: "Spritesheet.png",
    frameCount: 1,
    width: 32,
    height: 48,
    fps: 12,
  });
  assert.equal(normalizeSequenceFps(7), 8);
  assert.equal(buildFrameData(layout, 7).fps, 8);
});

test("thumbnail order moves by index", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
});

test("the animation builder is a static template that reads FrameData.json", () => {
  const script = buildAnimationClipScript();
  assert.equal(buildAnimationClipScript(), script);
  assert.equal(script.includes("${"), false);
  assert.equal(script.includes("file.name"), false);
  assert.match(script, /using UnityEditor\.Animations;/);
  assert.match(script, /File\.ReadAllText\(jsonPath\)/);
  assert.match(script, /JsonUtility\.FromJson<FrameDataFile>/);
  assert.match(script, /settings\.loopTime = true;/);
  assert.match(script, /Assets\/Animations\/SpriteForgeClip\.anim/);
  assert.match(script, /AnimatorController\.CreateAnimatorControllerAtPath/);
  assert.match(script, /"frame_" \+ i\.ToString\("00"\)/);
  assert.match(script, /SpriteAlignment\.BottomCenter/);
  assert.match(script, /texture\.height - data\.height/);
  assert.doesNotMatch(script, /FrameDataFile[\s\S]*public string/);
});
