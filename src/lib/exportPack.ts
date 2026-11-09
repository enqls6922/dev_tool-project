import { saveAs } from "file-saver";
import JSZip from "jszip";
import { generateUnityImporterScript } from "./imageProcessor";
import { serializeMetadata } from "./scriptSafety.ts";
import type { AtlasDocument } from "./types";

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG로 인코딩하지 못했습니다."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function downloadSpritePack(canvas: HTMLCanvasElement, document: AtlasDocument): Promise<void> {
  const zip = new JSZip();
  const png = await canvasToPngBlob(canvas);
  zip.file("Atlas.png", png);
  zip.file("Atlas.json", serializeMetadata(document));
  zip.file("Editor/SpriteSheetImporter.cs", generateUnityImporterScript());
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, "SpritePack.zip");
}
