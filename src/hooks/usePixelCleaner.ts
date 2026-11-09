"use client";

import { useEffect, useRef, useState } from "react";
import { downloadCleanedPng, downloadCleanedZip } from "@/lib/exportCleaned";
import { toPngDownloadName, uniqueFileNames } from "@/lib/fileNames";
import { canvasToPngBlob } from "@/lib/exportPack";
import {
  cleanCanvasGhostPixels,
  drawImageToCanvas,
  loadImage,
} from "@/lib/imageProcessor";
import { acceptRasterUploads, PIXEL_ART_LIMIT_MESSAGE } from "@/lib/uploadSecurity";

export type CleanerItem = {
  id: string;
  name: string;
  displayName: string;
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
    const { accepted, message } = acceptRasterUploads(files);
    if (message) setNotice(message);
    else setNotice(null);
    if (accepted.length === 0) return;

    const run = ++runRef.current;
    setBusy(true);
    const next = itemsRef.current.slice();
    for (let index = 0; index < accepted.length; index += 1) {
      if (!mountedRef.current || run !== runRef.current) return;
      const file = accepted[index];
      if (!file) continue;
      setProgress(`청소 ${index + 1} / ${accepted.length}`);
      const item = await cleanFile(file);
      if (item.message === PIXEL_ART_LIMIT_MESSAGE) setNotice(PIXEL_ART_LIMIT_MESSAGE);
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
      const names = uniqueFileNames(ready.map((item) => toPngDownloadName(item.name)));
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
  const displayName = file.name || "image.png";
  const name = toPngDownloadName(displayName);
  try {
    const image = await loadImage(file);
    const canvas = drawImageToCanvas(image, image.naturalWidth, image.naturalHeight);
    const removed = cleanCanvasGhostPixels(canvas);
    const afterBlob = await canvasToPngBlob(canvas);
    return {
      id,
      name,
      displayName,
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
      displayName,
      status: "error",
      message: caught instanceof Error ? caught.message : "이 파일을 읽지 못했습니다.",
    };
  }
}
