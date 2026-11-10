"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canvasToPngBlob } from "@/lib/exportPack";
import { downloadRuleTilePack } from "@/lib/exportRuleTile";
import {
  cleanCanvasGhostPixels,
  drawImageToCanvas,
  isPngFile,
  loadImage,
} from "@/lib/imageProcessor";
import { acceptRasterUploads } from "@/lib/uploadSecurity";
import {
  PRESET_INFO,
  analyzeSheet,
  suggestPreset,
  type FillMode,
  type RulePreset,
  type RuleTileSize,
  type SheetAnalysis,
} from "@/lib/ruleTile";

export function useRuleTileForge() {
  const [preset, setPresetState] = useState<RulePreset>("godot-47");
  const [fillMode, setFillModeState] = useState<FillMode>("floor");
  const [tileSize, setTileSizeState] = useState<RuleTileSize>(32);
  const [cleanGhostPixels, setCleanGhostPixelsState] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [ghostsRemoved, setGhostsRemoved] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const urlRef = useRef<string | null>(null);
  const exportRef = useRef<Blob | null>(null);
  const processingRef = useRef(false);
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const fileRef = useRef<File | null>(null);
  const cleanRef = useRef(true);
  const presetRef = useRef<RulePreset>("godot-47");
  const tileSizeRef = useRef<RuleTileSize>(32);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const analysis: SheetAnalysis | null = useMemo(() => {
    if (!imageSize) return null;
    return analyzeSheet({
      width: imageSize.width,
      height: imageSize.height,
      tileSize,
      preset,
      fillMode,
    });
  }, [imageSize, tileSize, preset, fillMode]);

  function releasePreview() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    exportRef.current = null;
  }

  async function renderSheet(source: File, clean: boolean) {
    const run = ++runRef.current;
    processingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const image = await loadImage(source);
      if (!mountedRef.current || run !== runRef.current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      const rasterize = clean || !isPngFile(source);
      let blob: Blob = source;
      let removed: number | null = null;
      if (rasterize) {
        const canvas = drawImageToCanvas(image, width, height);
        if (clean) removed = cleanCanvasGhostPixels(canvas);
        blob = await canvasToPngBlob(canvas);
        if (!mountedRef.current || run !== runRef.current) return;
      }

      const url = URL.createObjectURL(blob);
      if (!mountedRef.current || run !== runRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      releasePreview();
      urlRef.current = url;
      exportRef.current = blob;
      setPreviewUrl(url);
      setImageSize({ width, height });
      setGhostsRemoved(removed);
      setError(null);
      adoptPreset(width, height, tileSizeRef.current);
    } catch (caught) {
      if (!mountedRef.current || run !== runRef.current) return;
      releasePreview();
      setPreviewUrl(null);
      setImageSize(null);
      setGhostsRemoved(null);
      setError(caught instanceof Error ? caught.message : "이미지를 읽지 못했습니다.");
    } finally {
      if (mountedRef.current && run === runRef.current) {
        processingRef.current = false;
        setLoading(false);
      }
    }
  }

  function addFiles(files: File[]) {
    const { accepted, message } = acceptRasterUploads(files);
    if (accepted.length === 0) {
      setNotice(message ?? "PNG, JPG, WebP만 올릴 수 있습니다.");
      return;
    }
    if (accepted.length > 1 || message) {
      const picked = "타일셋 이미지 한 장만 사용합니다. 첫 번째 파일을 골랐습니다.";
      setNotice(message ? `${message} ${picked}` : picked);
    } else {
      setNotice(null);
    }
    const next = accepted[0];
    if (!next) return;
    fileRef.current = next;
    setFile(next);
    void renderSheet(next, cleanRef.current);
  }

  function adoptPreset(width: number, height: number, size: number) {
    const next = suggestPreset(width, height, size, presetRef.current);
    if (next === presetRef.current) return;
    presetRef.current = next;
    setPresetState(next);
    setNotice(`${PRESET_INFO[next].label} 프리셋을 시트 비율에 맞춰 골랐습니다.`);
  }

  function setPreset(next: RulePreset) {
    presetRef.current = next;
    setPresetState(next);
  }

  function setFillMode(next: FillMode) {
    setFillModeState(next);
  }

  function setTileSize(next: RuleTileSize) {
    tileSizeRef.current = next;
    setTileSizeState(next);
    if (imageSize) adoptPreset(imageSize.width, imageSize.height, next);
  }

  function setCleanGhostPixels(next: boolean) {
    cleanRef.current = next;
    setCleanGhostPixelsState(next);
    const source = fileRef.current;
    if (source) void renderSheet(source, next);
  }

  function clearSheet() {
    runRef.current += 1;
    processingRef.current = false;
    fileRef.current = null;
    releasePreview();
    setFile(null);
    setPreviewUrl(null);
    setImageSize(null);
    setGhostsRemoved(null);
    setLoading(false);
    setNotice(null);
    setError(null);
  }

  async function download() {
    if (!exportRef.current || processingRef.current || !analysis?.data) return;
    setDownloading(true);
    try {
      await downloadRuleTilePack(exportRef.current, analysis.data);
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught.message : "ZIP을 만들지 못했습니다.");
    } finally {
      if (mountedRef.current) setDownloading(false);
    }
  }

  return {
    preset,
    setPreset,
    fillMode,
    setFillMode,
    tileSize,
    setTileSize,
    cleanGhostPixels,
    setCleanGhostPixels,
    ghostsRemoved,
    file,
    previewUrl,
    imageSize,
    analysis,
    notice,
    error,
    loading,
    downloading,
    addFiles,
    clearSheet,
    download,
    dismissNotice: () => setNotice(null),
  };
}
