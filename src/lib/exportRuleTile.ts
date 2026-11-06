import { saveAs } from "file-saver";
import JSZip from "jszip";
import { buildRuleTileScript, type RuleDataFile } from "./ruleTile";

export async function downloadRuleTilePack(file: Blob, data: RuleDataFile): Promise<void> {
  const zip = new JSZip();
  zip.file("Tileset.png", file);
  zip.file("RuleData.json", `${JSON.stringify(data, null, 2)}\n`);
  zip.file("Editor/RuleTileBuilder.cs", buildRuleTileScript());
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, "RuleTilePack.zip");
}
