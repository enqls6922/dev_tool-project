"use client";

import { useEffect, useRef, useState } from "react";
import { downloadCleanedPng, downloadCleanedZip } from "@/lib/exportCleaned";
import { uniqueFileNames } from "@/lib/fileNames";
import { canvasToPngBlob } from "@/lib/exportPack";
import {
  MAX_IMAGE_EDGE,
  cleanCanvasGhostPixels,
  drawImageToCanvas,
  isPngFile,
  loadImage,
} from "@/lib/imageProcessor";

export type CleanerItem = {
  id: string;
  name: string;
  status: "ready" | "error";
  message?: string;
  width?: number;
  height?: number;
  removed?: number;
  beforeUrl?: string;
  afterUrl?: string;
  afterBlob?: Blob;
};

const ZOOMS = [4, 8, 16] as const;
export type CleanerZoom = (typeof ZOOMS)[number];

export function usePixelCleaner() {
  const [items, setItems] = useState<CleanerItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zoom, setZoom] = useState<CleanerZoom>(8);
  const itemsRef = useRef(items);
  const mountedRef = useRef(true);
  const runRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      for (const item of itemsRef.current) {
        if (item.beforeUrl) URL.revokeObjectURL(item.beforeUrl);
        if (item.afterUrl) URL.revokeObjectURL(item.afterUrl);
      }
    };
  }, []);

  async function addFiles(files: File[]) {
    const accepted = files.filter((file) => isPngFile(file));
    const rejected = files.filter((file) => !isPngFile(file));
    if (rejected.length > 0) {
      const sample = rejected
        .slice(0, 4)
        .map((file) => file.name || "unnamed")
        .join(", ");
      const extra = rejected.length > 4 ? ` 외 ${rejected.length - 4}개` : "";
      setNotice(`PNG가 아니라 건너뛰었습니다: ${sample}${extra}`);
    } else {
      setNotice(null);
    }
    if (accepted.length === 0) return;

    const run = ++runRef.current;
    setBusy(true);
    const next = itemsRef.current.slice();
    for (let index = 0; index < accepted.length; index += 1) {
      if (!mountedRef.current || run !== runRef.current) return;
      const file = accepted[index];
      setProgress(`청소 ${index + 1} / ${accepted.length}`);
      const item = await cleanFile(file);
      if (!mountedRef.current || run !== runRef.current) {
        if (item.beforeUrl) URL.revokeObjectURL(item.beforeUrl);
        if (item.afterUrl) URL.revokeObjectURL(item.afterUrl);
        return;
      }
      next.push(item);
      itemsRef.current = next.slice();
      setItems(next.slice());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!mountedRef.current || run !== runRef.current) return;
    setBusy(false);
    setProgress("");
  }

  function removeItem(id: string) {
    const current = itemsRef.current.find((item) => item.id === id);
    if (current?.beforeUrl) URL.revokeObjectURL(current.beforeUrl);
    if (current?.afterUrl) URL.revokeObjectURL(current.afterUrl);
    const next = itemsRef.current.filter((item) => item.id !== id);
    itemsRef.current = next;
    setItems(next);
  }

  function clearItems() {
    runRef.current += 1;
    for (const item of itemsRef.current) {
      if (item.beforeUrl) URL.revokeObjectURL(item.beforeUrl);
      if (item.afterUrl) URL.revokeObjectURL(item.afterUrl);
    }
    itemsRef.current = [];
    setItems([]);
    setBusy(false);
    setProgress("");
    setNotice(null);
  }

  function downloadOne(id: string) {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item?.afterBlob) return;
    downloadCleanedPng(item.afterBlob, item.name);
  }

  async function downloadZip() {
    const ready = itemsRef.current.filter((item) => item.status === "ready" && item.afterBlob);
    if (ready.length === 0 || zipping) return;
    setZipping(true);
    try {
      const names = uniqueFileNames(ready.map((item) => item.name));
      await downloadCleanedZip(
        ready.map((item, index) => ({
          name: names[index] ?? item.name,
          blob: item.afterBlob as Blob,
        })),
      );
    } catch (caught) {
      if (!mountedRef.current) return;
      setNotice(caught instanceof Error ? caught.message : "ZIP을 만들지 못했습니다.");
    } finally {
      if (mountedRef.current) setZipping(false);
    }
  }

  return {
    items,
    notice,
    progress,
    busy,
    zipping,
    zoom,
    zooms: ZOOMS,
    setZoom,
    addFiles,
    removeItem,
    clearItems,
    downloadOne,
    downloadZip,
    dismissNotice: () => setNotice(null),
  };
}

async function cleanFile(file: File): Promise<CleanerItem> {
  const id = crypto.randomUUID();
  const name = file.name || "image.png";
  try {
    const image = await loadImage(file);
    if (image.naturalWidth > MAX_IMAGE_EDGE || image.naturalHeight > MAX_IMAGE_EDGE) {
      throw new Error(`한 변이 ${MAX_IMAGE_EDGE}px를 넘습니다.`);
    }
    const canvas = drawImageToCanvas(image, image.naturalWidth, image.naturalHeight);
    const removed = cleanCanvasGhostPixels(canvas);
    const afterBlob = await canvasToPngBlob(canvas);
    return {
      id,
      name,
      status: "ready",
      width: image.naturalWidth,
      height: image.naturalHeight,
      removed,
      beforeUrl: URL.createObjectURL(file),
      afterUrl: URL.createObjectURL(afterBlob),
      afterBlob,
    };
  } catch (caught) {
    return {
      id,
      name,
      status: "error",
      message: caught instanceof Error ? caught.message : "이 파일을 읽지 못했습니다.",
    };
  }
}
