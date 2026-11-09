const DOWNLOAD_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/**
 * Stem safe for JSON sprite names and zip entries.
 * Whitespace becomes `_`. Every other character outside `[a-zA-Z0-9_.-]` is removed.
 */
export function sanitizeStem(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const stem = base.replace(/\.[^.]+$/, "").normalize("NFKC");
  return stem
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .slice(0, 80);
}

/** Download name with a raster extension. Never keeps a user-supplied path. */
export function sanitizeDownloadName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const extMatch = /\.([A-Za-z0-9]+)$/.exec(base);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
  const safeExt = DOWNLOAD_EXTENSIONS.has(ext) ? ext : ".png";
  const stem = sanitizeStem(base);
  return `${stem.length > 0 ? stem : "sprite"}${safeExt}`;
}

export function uniqueFileNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return `${name}_${count + 1}`;
    return `${name.slice(0, dot)}_${count + 1}${name.slice(dot)}`;
  });
}
