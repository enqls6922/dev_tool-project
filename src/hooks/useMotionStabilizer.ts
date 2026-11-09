"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeFilename } from "@/lib/fileNames";
import { canvasToPngBlob } from "@/lib/exportPack";
import { downloadMotionJson, downloadMotionPng } from "@/lib/exportMotion";
import {
  drawImageToCanvas,
  loadImage,
  toSpriteName,
  uniqueSpriteNames,
  type OpaqueBounds,
} from "@/lib/imageProcessor";
import { acceptRasterUploads, PIXEL_ART_LIMIT_MESSAGE } from "@/lib/uploadSecurity";
import {
  buildMotionDocument,
  compareFileNames,
  DEFAULT_MOTION_FPS,
  findMotionBounds,
  layoutMotionFrames,
  MOTION_FPS,
  renderSpriteStrip,
  renderStabilizedCanvas,
  type MotionFps,
  type MotionLayout,
  type MotionSheetDocument,
} from "@/lib/motionStabilizer";

export type MotionFrameStatus = "ready" | "empty" | "error";

export type MotionFrame = {
  id: string;
  name: string;
  fileName: string;
  status: MotionFrameStatus;
  message?: string;
  sourceWidth: number;
  sourceHeight: number;
  previewUrl: string;
  sourceCanvas: HTMLCanvasElement | null;
  bounds: OpaqueBounds | null;
};

function release(frame: MotionFrame) {
  if (frame.previewUrl) URL.revokeObjectURL(frame.previewUrl);
}

async function decodeFrame(file: File): Promise<MotionFrame> {
  const id = crypto.randomUUID();
  const name = toSpriteName(file.name);
  try {
    const image = await loadImage(file);
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("이미지 크기가 없습니다.");
    }
    const sourceCanvas = drawImageToCanvas(image, image.naturalWidth, image.naturalHeight);
    const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
    const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const bounds = findMotionBounds(imageData.data, sourceCanvas.width, sourceCanvas.height);
    return {
      id,
      name,
      fileName: sanitizeFilename(file.name, "frame"),
      status: bounds ? "ready" : "empty",
      message: bounds ? undefined : "알파 30을 넘는 픽셀이 없습니다.",
      sourceWidth: sourceCanvas.width,
      sourceHeight: sourceCanvas.height,
      previewUrl: URL.createObjectURL(file),
      sourceCanvas,
      bounds,
    };
  } catch (caught) {
    return {
      id,
      name,
      fileName: sanitizeFilename(file.name, "frame"),
      status: "error",
      message: caught instanceof Error ? caught.message : "이 파일을 읽지 못했습니다.",
      sourceWidth: 0,
      sourceHeight: 0,
      previewUrl: "",
      sourceCanvas: null,
      bounds: null,
    };
  }
}

export function useMotionStabilizer(active: boolean) {
  const [frames, setFrames] = useState<MotionFrame[]>([]);
  const [fps, setFps] = useState<MotionFps>(DEFAULT_MOTION_FPS);
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [showGround, setShowGround] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [downloading, setDownloading] = useState<"png" | "json" | null>(null);
  const framesRef = useRef(frames);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      for (const frame of framesRef.current) release(frame);
    };
  }, []);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  const playable = useMemo(() => frames.filter((frame) => frame.status !== "error"), [frames]);

  const layoutResult = useMemo(() => {
    try {
      const layout = layoutMotionFrames(playable.map((frame) => ({ bounds: frame.bounds })));
      return { layout, error: null as string | null };
    } catch (caught) {
      return {
        layout: null as MotionLayout | null,
        error: caught instanceof Error ? caught.message : "보정에 실패했습니다.",
      };
    }
  }, [playable]);

  const sheet = useMemo(() => {
    if (!layoutResult.layout) return null;
    try {
      const names = uniqueSpriteNames(playable.map((frame) => frame.name));
      return buildMotionDocument(layoutResult.layout, names, fps);
    } catch (caught) {
      return caught instanceof Error ? caught.message : "시트를 만들지 못했습니다.";
    }
  }, [layoutResult.layout, playable, fps]);

  const sheetDocument = sheet && typeof sheet !== "string" ? sheet : null;
  const sheetError = typeof sheet === "string" ? sheet : layoutResult.error;

  useEffect(() => {
    if (!active || !playing || playable.length < 2) return;
    const delay = 1000 / fps;
    const id = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % playable.length);
    }, delay);
    return () => window.clearInterval(id);
  }, [active, playing, fps, playable.length]);

  async function ingest(files: File[], generation: number) {
    const { accepted, message } = acceptRasterUploads(files);
    if (!mountedRef.current || generation !== generationRef.current) return;
    if (message) setNotice(message);
    else if (accepted.length > 0) setNotice(null);
    if (accepted.length === 0) return;

    setBusy(true);
    for (let index = 0; index < accepted.length; index += 1) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      const file = accepted[index];
      if (!file) continue;
      setProgress(`읽는 중 ${index + 1} / ${accepted.length}`);
      const frame = await decodeFrame(file);
      if (frame.message === PIXEL_ART_LIMIT_MESSAGE) setNotice(PIXEL_ART_LIMIT_MESSAGE);
      if (!mountedRef.current || generation !== generationRef.current) {
        release(frame);
        return;
      }
      setFrames((current) => (current.some((item) => item.id === frame.id) ? current : [...current, frame]));
    }
    if (mountedRef.current && generation === generationRef.current) {
      setBusy(false);
      setProgress("");
    }
  }

  function addFiles(files: File[]) {
    const generation = generationRef.current;
    queueRef.current = queueRef.current
      .then(() => ingest(files, generation))
      .catch(() => undefined);
  }

  function commitOrder(next: MotionFrame[]) {
    const currentId = playable[frameIndex]?.id;
    framesRef.current = next;
    setFrames(next);
    if (!currentId) return;
    const nextIndex = next.filter((frame) => frame.status !== "error").findIndex((frame) => frame.id === currentId);
    if (nextIndex >= 0) setFrameIndex(nextIndex);
  }

  function removeFrame(id: string) {
    const current = framesRef.current;
    const frame = current.find((item) => item.id === id);
    if (frame) release(frame);
    const next = current.filter((item) => item.id !== id);
    const removedAt = current.filter((item) => item.status !== "error").findIndex((item) => item.id === id);
    const nextPlayable = next.filter((item) => item.status !== "error").length;
    framesRef.current = next;
    setFrames(next);
    setFrameIndex((index) => {
      if (nextPlayable === 0) return 0;
      const shifted = removedAt >= 0 && removedAt < index ? index - 1 : index;
      return Math.min(shifted, nextPlayable - 1);
    });
  }

  function moveFrame(id: string, direction: -1 | 1) {
    const next = framesRef.current.slice();
    const index = next.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    commitOrder(next);
  }

  function reorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const next = framesRef.current.slice();
    const from = next.findIndex((item) => item.id === sourceId);
    if (from < 0) return;
    const [item] = next.splice(from, 1);
    const to = next.findIndex((item) => item.id === targetId);
    if (!item || to < 0) return;
    next.splice(to, 0, item);
    commitOrder(next);
  }

  function sortByName() {
    commitOrder(framesRef.current.slice().sort((a, b) => compareFileNames(a.fileName, b.fileName)));
  }

  function clearFrames() {
    generationRef.current += 1;
    for (const frame of framesRef.current) release(frame);
    framesRef.current = [];
    setFrames([]);
    setFrameIndex(0);
    setBusy(false);
    setProgress("");
    setNotice(null);
  }

  function step(direction: -1 | 1) {
    setPlaying(false);
    setFrameIndex((index) => {
      if (playable.length === 0) return 0;
      return (index + direction + playable.length) % playable.length;
    });
  }

  function showFrame(id: string) {
    const index = playable.findIndex((frame) => frame.id === id);
    if (index < 0) return;
    setPlaying(false);
    setFrameIndex(index);
  }

  function renderedFrames() {
    const layout = layoutResult.layout;
    if (!layout || !sheetDocument) throw new Error(sheetError ?? "보정할 프레임이 없습니다.");
    return playable.map((frame, index) => {
      const placement = layout.placements[index];
      return renderStabilizedCanvas(
        placement?.bounds ? frame.sourceCanvas : null,
        placement?.destX ?? 0,
        placement?.destY ?? 0,
        layout.canvasWidth,
        layout.canvasHeight,
      );
    });
  }

  async function downloadPng() {
    if (downloading || !sheetDocument) return;
    setDownloading("png");
    try {
      const strip = renderSpriteStrip(renderedFrames());
      const blob = await canvasToPngBlob(strip);
      downloadMotionPng(blob);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "시트를 만들지 못했습니다.");
    } finally {
      if (mountedRef.current) setDownloading(null);
    }
  }

  function downloadJson() {
    if (downloading || !sheetDocument) return;
    setDownloading("json");
    try {
      downloadMotionJson(sheetDocument);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "JSON을 만들지 못했습니다.");
    } finally {
      setDownloading(null);
    }
  }

  return {
    frames,
    playable,
    layout: layoutResult.layout,
    sheet: sheetDocument as MotionSheetDocument | null,
    sheetError,
    fps,
    fpsOptions: MOTION_FPS,
    setFps,
    playing,
    setPlaying,
    frameIndex,
    step,
    showFrame,
    showGround,
    setShowGround,
    notice,
    dismissNotice: () => setNotice(null),
    busy,
    progress,
    downloading,
    addFiles,
    removeFrame,
    moveFrame,
    reorder,
    sortByName,
    clearFrames,
    downloadPng,
    downloadJson,
  };
}
