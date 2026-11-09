const FILENAME_FALLBACK = "file";

/**
 * Keep ASCII letters, digits, underscore, hyphen, and dot.
 * Every other character (quotes, semicolon, slash, brackets, whitespace, and so on)
 * becomes an underscore. Directory pieces and ".." are removed so the result is
 * a single zip entry name.
 */
export function sanitizeFilename(input: string, fallback = FILENAME_FALLBACK): string {
  const trimmed = input.normalize("NFKC").trim();
  const base = trimmed.split(/[/\\]/).filter((part) => part.length > 0).pop() ?? "";
  const replaced = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_").replace(/\.{2,}/g, ".");

  const dot = replaced.lastIndexOf(".");
  let stem = replaced;
  let extension = "";
  if (dot > 0 && dot < replaced.length - 1) {
    const maybe = replaced.slice(dot + 1);
    if (/^[A-Za-z0-9]+$/.test(maybe) && maybe.length <= 8) {
      stem = replaced.slice(0, dot);
      extension = `.${maybe.toLowerCase()}`;
    }
  }

  stem = stem.replace(/\./g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!stem) {
    const safeFallback = fallback.replace(/[^A-Za-z0-9_-]/g, "").replace(/^_+|_+$/g, "");
    stem = safeFallback || FILENAME_FALLBACK;
  }
  return `${stem.slice(0, 80)}${extension}`;
}

/** Sprite id written into JSON. Same allowlist, with dots folded into underscores. */
export function sanitizeSpriteName(input: string, fallback = "sprite"): string {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (cleaned) return cleaned;
  const safeFallback = fallback.replace(/[^A-Za-z0-9_-]/g, "").replace(/^_+|_+$/g, "");
  return safeFallback || "sprite";
}

/** Cleaned exports are PNG bytes, so the download name always ends in .png. */
export function toPngDownloadName(input: string): string {
  const safe = sanitizeFilename(input, "image");
  const dot = safe.lastIndexOf(".");
  const stem = (dot > 0 ? safe.slice(0, dot) : safe).replace(/^_+|_+$/g, "");
  return `${stem || "image"}.png`;
}

const DOWNLOAD_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/**
 * Removal form of the filename allowlist.
 * Whitespace becomes `_`. Every other character outside `[a-zA-Z0-9_.-]` is deleted.
 * Zip entries and JSON sprite ids use `sanitizeFilename` / `sanitizeSpriteName`, which
 * replace those characters with `_` instead.
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
