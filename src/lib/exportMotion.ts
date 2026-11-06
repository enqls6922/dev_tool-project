import { saveAs } from "file-saver";
import { SPRITESHEET_JSON, SPRITESHEET_PNG, type MotionSheetDocument } from "./motionStabilizer";

export function downloadMotionPng(blob: Blob): void {
  saveAs(blob, SPRITESHEET_PNG);
}

export function downloadMotionJson(document: MotionSheetDocument): void {
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  saveAs(blob, SPRITESHEET_JSON);
}
