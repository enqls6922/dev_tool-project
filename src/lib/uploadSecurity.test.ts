import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { staticScript } from "./scriptSafety.ts";
import {
  ACCEPTED_RASTER_ACCEPT,
  assertPixelArtEdge,
  inspectUpload,
  looksLikeActiveContent,
  MAX_PIXEL_ART_EDGE,
  PIXEL_ART_LIMIT_MESSAGE,
  readRasterDimensions,
  uploadRejectionMessage,
} from "./uploadSecurity.ts";

test("static C# templates reject interpolated values", () => {
  assert.equal(staticScript`Editor script`, "Editor script");
  assert.throws(() => staticScript`name = ${"hero"}`, /JSON/);
});

test("raster uploads accept png, jpeg, and webp and reject svg, markup, and oversized files", () => {
  assert.equal(ACCEPTED_RASTER_ACCEPT, "image/png, image/jpeg, image/webp");
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "hero.png", { type: "image/png" })), null);
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "hero.jpg", { type: "image/jpeg" })), null);
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "hero.jpeg", { type: "" })), null);
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "hero.webp", { type: "image/webp" })), null);

  const svg = inspectUpload(new File([new Uint8Array(8)], "icon.svg", { type: "image/svg+xml" }));
  assert.equal(svg?.reason, "svg");
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "evil.png", { type: "image/svg+xml" }))?.reason, "svg");
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "poly.svg", { type: "image/png" }))?.reason, "svg");
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" }))?.reason, "type");
  assert.equal(inspectUpload(new File([new Uint8Array(8)], "page.html", { type: "image/png" }))?.reason, "type");

  const oversized = inspectUpload(
    new File([new Uint8Array(15 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }),
  );
  assert.equal(oversized?.reason, "size");
  assert.match(uploadRejectionMessage([svg!, oversized!]), /SVG/);
  assert.match(uploadRejectionMessage([oversized!]), /15MB/);
});

test("image headers stop a canvas larger than 4096px before decode", () => {
  assert.deepEqual(readRasterDimensions(pngBytes(32, 48)), { width: 32, height: 48 });
  assert.deepEqual(readRasterDimensions(jpegBytes(64, 40)), { width: 64, height: 40 });
  assert.deepEqual(readRasterDimensions(webpBytes(96, 96)), { width: 96, height: 96 });
  assert.equal(readRasterDimensions(pngBytes(MAX_PIXEL_ART_EDGE, 16))?.width, MAX_PIXEL_ART_EDGE);
  assert.throws(() => assertPixelArtEdge(MAX_PIXEL_ART_EDGE + 1, 8), { message: PIXEL_ART_LIMIT_MESSAGE });
  assert.doesNotThrow(() => assertPixelArtEdge(MAX_PIXEL_ART_EDGE, MAX_PIXEL_ART_EDGE));
  assert.equal(looksLikeActiveContent(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), true);
  assert.equal(looksLikeActiveContent(pngBytes(8, 8)), false);
});

test("file lists, tooltips, and labels are not written with innerHTML", () => {
  const root = path.join(process.cwd(), "src");
  const files = walk(root).filter((file) => /\.(tsx|ts|jsx|js)$/.test(file) && !file.endsWith(".test.ts"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(source, /\.innerHTML\s*=/);
    assert.doesNotMatch(source, /insertAdjacentHTML/);
  }
});

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[11] = 13;
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0,
    0x00, 0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
  ]);
}

function webpBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 10, true);
  const canvasWidth = width - 1;
  const canvasHeight = height - 1;
  bytes[24] = canvasWidth & 255;
  bytes[25] = (canvasWidth >> 8) & 255;
  bytes[26] = (canvasWidth >> 16) & 255;
  bytes[27] = canvasHeight & 255;
  bytes[28] = (canvasHeight >> 8) & 255;
  bytes[29] = (canvasHeight >> 16) & 255;
  return bytes;
}
