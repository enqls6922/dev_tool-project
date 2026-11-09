import { saveAs } from "file-saver";
import JSZip from "jszip";
import { toPngDownloadName } from "./fileNames.ts";

export function downloadCleanedPng(blob: Blob, name: string): void {
  saveAs(blob, toPngDownloadName(name));
}

export async function downloadCleanedZip(files: { name: string; blob: Blob }[]): Promise<void> {
  if (files.length === 0) {
    throw new Error("저장할 이미지가 없습니다.");
  }
  const zip = new JSZip();
  for (const file of files) {
    zip.file(toPngDownloadName(file.name), file.blob);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, "PixelClean.zip");
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
