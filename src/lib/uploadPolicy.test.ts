import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRasterRejection, isAllowedRasterFile, isBlockedSvg, partitionRasterFiles } from "./uploadPolicy.ts";

test("svg is blocked by mime, extension, and a disguised suffix", () => {
  assert.equal(isBlockedSvg({ name: "icon.svg", type: "" }), true);
  assert.equal(isBlockedSvg({ name: "icon.svgz", type: "application/octet-stream" }), true);
  assert.equal(isBlockedSvg({ name: "icon.png", type: "image/svg+xml" }), true);
  assert.equal(isBlockedSvg({ name: "icon.svg.png", type: "image/png" }), true);
  assert.equal(isAllowedRasterFile({ name: "icon.svg", type: "image/svg+xml" }), false);
  assert.equal(isAllowedRasterFile({ name: "icon.svg.png", type: "image/png" }), false);
});

test("png, jpeg, and webp are accepted", () => {
  assert.equal(isAllowedRasterFile({ name: "a.png", type: "image/png" }), true);
  assert.equal(isAllowedRasterFile({ name: "a.jpg", type: "image/jpeg" }), true);
  assert.equal(isAllowedRasterFile({ name: "a.jpeg", type: "" }), true);
  assert.equal(isAllowedRasterFile({ name: "a.webp", type: "application/octet-stream" }), true);
  assert.equal(isAllowedRasterFile({ name: "a.gif", type: "image/gif" }), false);
  assert.equal(isAllowedRasterFile({ name: "a.txt", type: "" }), false);

  const { accepted, rejected } = partitionRasterFiles([
    { name: "ok.png", type: "image/png" },
    { name: "no.svg", type: "image/svg+xml" },
    { name: "ok.webp", type: "image/webp" },
  ]);
  assert.deepEqual(accepted.map((file) => file.name), ["ok.png", "ok.webp"]);
  assert.match(formatRasterRejection(rejected), /SVG/);
  assert.match(formatRasterRejection(rejected), /no\.svg/);
});
