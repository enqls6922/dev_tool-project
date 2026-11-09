import { saveAs } from "file-saver";
import JSZip from "jszip";
import { canvasToPngBlob } from "./exportPack";
import {
  buildAnimationClipScript,
  buildFrameData,
  FRAME_DATA_JSON,
  FRAME_SHEET_PNG,
  layoutFrameStrip,
  type SequenceFps,
} from "./frameSequencer";
import { MAX_ATLAS_EDGE } from "./imageProcessor";

export async function downloadFrameSequence(
  frames: readonly HTMLCanvasElement[],
  fps: SequenceFps,
): Promise<void> {
  const layout = layoutFrameStrip(frames.map((frame) => ({ width: frame.width, height: frame.height })));
  if (layout.sheetWidth > MAX_ATLAS_EDGE || layout.sheetHeight > MAX_ATLAS_EDGE) {
    throw new Error(
      `스트립 ${layout.sheetWidth}×${layout.sheetHeight}px가 한도 ${MAX_ATLAS_EDGE}px를 넘습니다. 프레임을 줄이거나 해상도를 낮추세요.`,
    );
  }

  const sheet = document.createElement("canvas");
  sheet.width = layout.sheetWidth;
  sheet.height = layout.sheetHeight;
  const context = sheet.getContext("2d");
  if (!context) throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
  context.imageSmoothingEnabled = false;
  frames.forEach((frame, index) => {
    const place = layout.placements[index];
    if (!place) return;
    context.drawImage(frame, place.x, place.y);
  });

  const zip = new JSZip();
  zip.file(FRAME_SHEET_PNG, await canvasToPngBlob(sheet));
  zip.file(FRAME_DATA_JSON, `${JSON.stringify(buildFrameData(layout, fps), null, 2)}\n`);
  zip.file("Editor/AnimationClipBuilder.cs", buildAnimationClipScript());
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, "FrameSequence.zip");
}
