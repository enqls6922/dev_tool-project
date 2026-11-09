import { sanitizeFilename } from "./fileNames.ts";

export const ACCEPTED_RASTER_ACCEPT = "image/png, image/jpeg, image/webp";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PIXEL_ART_EDGE = 4096;
export const PIXEL_ART_LIMIT_MESSAGE = "픽셀아트 규격(최대 4096px)을 초과했습니다";
export const FILE_TOO_LARGE_MESSAGE = "파일당 최대 15MB를 초과해 업로드를 거부했습니다.";
export const REJECTED_FILE_MESSAGE =
  "SVG와 이미지가 아닌 파일은 올릴 수 없습니다. PNG, JPG, WebP만 처리합니다.";

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export type UploadRejectReason = "svg" | "type" | "size";

export type UploadRejection = {
  file: File;
  reason: UploadRejectReason;
};

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function mimeMatchesExtension(type: string, extension: string): boolean {
  if (type === "image/png") return extension === ".png";
  if (type === "image/jpeg" || type === "image/jpg") return extension === ".jpg" || extension === ".jpeg";
  if (type === "image/webp") return extension === ".webp";
  return false;
}

/** MIME plus extension gate used by the drop zone and every ingest path. */
export function inspectUpload(file: File): UploadRejection | null {
  const type = file.type.trim().toLowerCase();
  const extension = fileExtension(file.name);
  const lowerName = file.name.toLowerCase();
  if (type === "image/svg+xml" || extension === ".svg" || extension === ".svgz" || lowerName.includes(".svg.")) {
    return { file, reason: "svg" };
  }
  if (file.size > MAX_UPLOAD_BYTES) return { file, reason: "size" };
  if (file.size <= 0) return { file, reason: "type" };

  const extensionOk = RASTER_EXTENSIONS.has(extension);
  const typeOk = type === "image/png" || type === "image/jpeg" || type === "image/jpg" || type === "image/webp";
  if (!type || type === "application/octet-stream") {
    return extensionOk ? null : { file, reason: "type" };
  }
  if (!typeOk || !extensionOk || !mimeMatchesExtension(type, extension)) {
    return { file, reason: "type" };
  }
  return null;
}

export function partitionUploads(files: readonly File[]): { accepted: File[]; rejected: UploadRejection[] } {
  const accepted: File[] = [];
  const rejected: UploadRejection[] = [];
  for (const file of files) {
    const rejection = inspectUpload(file);
    if (rejection) rejected.push(rejection);
    else accepted.push(file);
  }
  return { accepted, rejected };
}

export function acceptRasterUploads(files: readonly File[]): { accepted: File[]; message: string | null } {
  const { accepted, rejected } = partitionUploads(files);
  return {
    accepted,
    message: rejected.length > 0 ? uploadRejectionMessage(rejected) : null,
  };
}

export function uploadRejectionMessage(rejected: readonly UploadRejection[]): string {
  if (rejected.length === 0) return "";
  const blocked = rejected.filter((item) => item.reason === "svg" || item.reason === "type");
  const oversized = rejected.filter((item) => item.reason === "size");
  const parts: string[] = [];
  if (blocked.length > 0) parts.push(`${REJECTED_FILE_MESSAGE} ${sampleNames(blocked)}`);
  if (oversized.length > 0) parts.push(`${FILE_TOO_LARGE_MESSAGE} ${sampleNames(oversized)}`);
  return parts.join(" ");
}

function sampleNames(items: readonly UploadRejection[]): string {
  const sample = items
    .slice(0, 4)
    .map((item) => sanitizeFilename(item.file.name, "file"))
    .join(", ");
  const extra = items.length > 4 ? ` 외 ${items.length - 4}개` : "";
  return `(${sample}${extra})`;
}

export function assertPixelArtEdge(width: number, height: number): void {
  if (width > MAX_PIXEL_ART_EDGE || height > MAX_PIXEL_ART_EDGE) {
    throw new Error(PIXEL_ART_LIMIT_MESSAGE);
  }
}

/** XML, HTML, and SVG text must never reach the image decoder. */
export function looksLikeActiveContent(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  let start = 0;
  if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) start = 3;
  let text = "";
  for (let index = start; index < sample.length; index += 1) {
    const byte = sample[index] ?? 0;
    if (byte === 0) return false;
    text += String.fromCharCode(byte);
  }
  const head = text.trimStart().toLowerCase();
  return (
    head.startsWith("<svg") ||
    head.startsWith("<?xml") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<script") ||
    head.startsWith("<math")
  );
}

export function readRasterDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  return readPngSize(bytes) ?? readJpegSize(bytes) ?? readWebpSize(bytes);
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return null;
  }
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset] ?? 0;
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) return null;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (length < 7 || offset + 6 >= bytes.length) return null;
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  if (!ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;
  const chunk = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
  if (chunk === "VP8X") {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }
  if (chunk === "VP8 ") {
    const start = 20;
    if (bytes.length < start + 10) return null;
    if (bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
    const width = ((bytes[start + 6] ?? 0) | ((bytes[start + 7] ?? 0) << 8)) & 0x3fff;
    const height = ((bytes[start + 8] ?? 0) | ((bytes[start + 9] ?? 0) << 8)) & 0x3fff;
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }
  if (chunk === "VP8L") {
    const start = 20;
    if (bytes.length < start + 5 || bytes[start] !== 0x2f) return null;
    const bits =
      (bytes[start + 1] ?? 0) |
      ((bytes[start + 2] ?? 0) << 8) |
      ((bytes[start + 3] ?? 0) << 16) |
      ((bytes[start + 4] ?? 0) << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}
