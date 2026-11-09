export type NamedFile = {
  name: string;
  type: string;
};

const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const RASTER_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

/** SVG is rejected even when the mime or an extra suffix tries to disguise it. */
export function isBlockedSvg(file: NamedFile): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml") return true;
  if (name.endsWith(".svg") || name.endsWith(".svgz")) return true;
  if (name.includes(".svg.")) return true;
  return false;
}

export function isAllowedRasterFile(file: NamedFile): boolean {
  if (isBlockedSvg(file)) return false;
  const type = file.type.toLowerCase();
  if (RASTER_TYPES.has(type)) return true;
  if (type && type !== "application/octet-stream") return false;
  const name = file.name.toLowerCase();
  return RASTER_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function partitionRasterFiles<T extends NamedFile>(files: readonly T[]): {
  accepted: T[];
  rejected: T[];
} {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const file of files) {
    if (isAllowedRasterFile(file)) accepted.push(file);
    else rejected.push(file);
  }
  return { accepted, rejected };
}

/** Strip control characters before a rejected name is shown in the UI. */
export function safeDisplayName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(0, 80) || "unnamed";
}

export function formatRasterRejection(rejected: readonly NamedFile[]): string {
  const sample = rejected
    .slice(0, 4)
    .map((file) => safeDisplayName(file.name))
    .join(", ");
  const extra = rejected.length > 4 ? ` 외 ${rejected.length - 4}개` : "";
  return `PNG, JPG, WebP만 올릴 수 있습니다. SVG와 그 외 형식은 건너뛰었습니다: ${sample}${extra}`;
}
