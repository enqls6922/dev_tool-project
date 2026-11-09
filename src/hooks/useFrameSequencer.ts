"use client";

import { useEffect, useRef, useState } from "react";
import { downloadFrameSequence } from "@/lib/exportSequence";
import {
  DEFAULT_SEQUENCE_FPS,
  moveItem,
  SEQUENCE_FPS,
  type SequenceFps,
} from "@/lib/frameSequencer";
import { drawImageToCanvas, loadImage, MAX_IMAGE_EDGE, toSpriteName } from "@/lib/imageProcessor";
import { formatRasterRejection, partitionRasterFiles } from "@/lib/uploadPolicy";

const MAX_FRAMES = 64;

export type SequenceFrame = {
  id: string;
  label: string;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  thumbUrl: string;
};

function makeThumb(canvas: HTMLCanvasElement): string {
  const maxEdge = 96;
  const scale = Math.min(1, maxEdge / canvas.width, maxEdge / canvas.height);
  const thumb = document.createElement("canvas");
  thumb.width = Math.max(1, Math.round(canvas.width * scale));
  thumb.height = Math.max(1, Math.round(canvas.height * scale));
  const context = thumb.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = false;
  context.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/png");
}

async function decodeFrame(file: File): Promise<SequenceFrame> {
  const image = await loadImage(file);
  if (image.naturalWidth > MAX_IMAGE_EDGE || image.naturalHeight > MAX_IMAGE_EDGE) {
    throw new Error(`한 변이 ${MAX_IMAGE_EDGE}px를 넘습니다.`);
  }
  if (image.naturalWidth < 1 || image.naturalHeight < 1) {
    throw new Error("이미지 크기가 없습니다.");
  }
  const canvas = drawImageToCanvas(image, image.naturalWidth, image.naturalHeight);
  return {
    id: crypto.randomUUID(),
    label: toSpriteName(file.name),
    width: canvas.width,
    height: canvas.height,
    canvas,
    thumbUrl: makeThumb(canvas),
  };
}

export function useFrameSequencer() {
  const [frames, setFrames] = useState<SequenceFrame[]>([]);
  const [fps, setFpsState] = useState<SequenceFps>(DEFAULT_SEQUENCE_FPS);
  const [showGround, setShowGround] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const framesRef = useRef(frames);
  const fpsRef = useRef(fps);
  const mountedRef = useRef(true);
  const runRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
    };
  }, []);

  useEffect(() => {
    framesRef.current = frames;
    fpsRef.current = fps;
  });

  async function addFiles(files: File[]) {
    const { accepted, rejected } = partitionRasterFiles(files);
    const notes: string[] = [];
    if (rejected.length > 0) notes.push(formatRasterRejection(rejected));

    const room = MAX_FRAMES - framesRef.current.length;
    const batch = accepted.slice(0, Math.max(0, room));
    if (accepted.length > batch.length) {
      notes.push(`프레임은 ${MAX_FRAMES}장까지입니다. 넘는 파일은 건너뛰었습니다.`);
    }
    setNotice(notes.length > 0 ? notes.join(" ") : null);
    if (batch.length === 0) return;

    const run = ++runRef.current;
    setBusy(true);
    setError(null);
    const next = framesRef.current.slice();
    const failed: string[] = [];
    for (const file of batch) {
      if (!mountedRef.current || run !== runRef.current) return;
      try {
        next.push(await decodeFrame(file));
      } catch (caught) {
        failed.push(caught instanceof Error ? caught.message : "이 파일을 읽지 못했습니다.");
      }
    }
    if (!mountedRef.current || run !== runRef.current) return;
    framesRef.current = next;
    setFrames(next);
    if (failed.length > 0) {
      setNotice([notes.join(" "), failed.slice(0, 2).join(" ")].filter(Boolean).join(" "));
    }
    setBusy(false);
  }

  function moveFrame(from: number, to: number) {
    setFrames((current) => {
      const next = moveItem(current, from, to);
      framesRef.current = next;
      return next;
    });
  }

  function removeFrame(id: string) {
    setFrames((current) => {
      const next = current.filter((frame) => frame.id !== id);
      framesRef.current = next;
      return next;
    });
  }

  function clearFrames() {
    runRef.current += 1;
    framesRef.current = [];
    setFrames([]);
    setBusy(false);
    setError(null);
    setNotice(null);
  }

  function setFps(next: SequenceFps) {
    fpsRef.current = next;
    setFpsState(next);
  }

  async function download() {
    if (framesRef.current.length === 0 || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadFrameSequence(
        framesRef.current.map((frame) => frame.canvas),
        fpsRef.current,
      );
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught.message : "ZIP을 만들지 못했습니다.");
    } finally {
      if (mountedRef.current) setDownloading(false);
    }
  }

  return {
    frames,
    fps,
    fpsOptions: SEQUENCE_FPS,
    showGround,
    setShowGround,
    playing,
    setPlaying,
    notice,
    error,
    busy,
    downloading,
    addFiles,
    moveFrame,
    removeFrame,
    clearFrames,
    setFps,
    download,
    dismissNotice: () => setNotice(null),
  };
}
