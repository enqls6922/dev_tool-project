"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadRuleTilePack } from "@/lib/exportRuleTile";
import { isPngFile, loadImage } from "@/lib/imageProcessor";
import {
  analyzeSheet,
  type RulePreset,
  type RuleTileSize,
  type SheetAnalysis,
} from "@/lib/ruleTile";

export function useRuleTileForge() {
  const [preset, setPreset] = useState<RulePreset>("15-tileset");
  const [tileSize, setTileSize] = useState<RuleTileSize>(32);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const urlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    });
  }, [imageSize, tileSize, preset]);

  async function addFiles(files: File[]) {
    const pngs = files.filter((item) => isPngFile(item));
    if (pngs.length === 0) {
      setNotice("PNG만 올릴 수 있습니다.");
      return;
    }
    if (pngs.length > 1 || pngs.length !== files.length) {
      setNotice("타일셋 PNG 한 장만 사용합니다. 첫 번째 PNG를 골랐습니다.");
    } else {
      setNotice(null);
    }

    setLoading(true);
    setError(null);
    try {
      const image = await loadImage(pngs[0]);
      if (!mountedRef.current) return;
      const url = URL.createObjectURL(pngs[0]);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setFile(pngs[0]);
      setPreviewUrl(url);
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught.message : "이미지를 읽지 못했습니다.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function clearSheet() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    setImageSize(null);
    setNotice(null);
    setError(null);
  }

  async function download() {
    if (!file || !analysis?.data) return;
    setDownloading(true);
    try {
      await downloadRuleTilePack(file, analysis.data);
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
    tileSize,
    setTileSize,
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
