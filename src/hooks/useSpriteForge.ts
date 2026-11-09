"use client";

import { useEffect, useRef, useState } from "react";
import { canvasToPngBlob, downloadSpritePack } from "@/lib/exportPack";
import {
  buildAtlasDocument,
  normalizeSprite,
  packSprites,
  toSpriteName,
  uniqueSpriteNames,
} from "@/lib/imageProcessor";
import { acceptRasterUploads, PIXEL_ART_LIMIT_MESSAGE } from "@/lib/uploadSecurity";
import {
  DEFAULT_SETTINGS,
  type AtlasDocument,
  type PackSettings,
  type SpriteRecord,
  type SpriteRect,
} from "@/lib/types";

export type PreviewPack = {
  canvas: HTMLCanvasElement;
  previewUrl: string;
  width: number;
  height: number;
  sprites: SpriteRect[];
  fill: number;
  document: AtlasDocument;
};

type Phase = "idle" | "processing" | "ready" | "error";

export function useSpriteForge() {
  const [sources, setSources] = useState<SpriteRecord[]>([]);
  const [settings, setSettings] = useState<PackSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pack, setPack] = useState<PreviewPack | null>(null);
  const [downloading, setDownloading] = useState(false);

  const sourcesRef = useRef(sources);
  const settingsRef = useRef(settings);
  const packRef = useRef(pack);
  const phaseRef = useRef(phase);
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const blockNavigation = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", blockNavigation);
    window.addEventListener("drop", blockNavigation);
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (packRef.current) URL.revokeObjectURL(packRef.current.previewUrl);
      window.removeEventListener("dragover", blockNavigation);
      window.removeEventListener("drop", blockNavigation);
    };
  }, []);

  sourcesRef.current = sources;
  settingsRef.current = settings;
  packRef.current = pack;
  phaseRef.current = phase;

  const commit = (apply: () => void) => {
    if (mountedRef.current) apply();
  };

  const clearDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  async function reprocess(list: SpriteRecord[], nextSettings: PackSettings) {
    const run = ++runRef.current;
    const alive = () => mountedRef.current && runRef.current === run;

    if (list.length === 0) {
      if (packRef.current) URL.revokeObjectURL(packRef.current.previewUrl);
      commit(() => {
        setPack(null);
        setPhase("idle");
        setProgress("");
        setError(null);
      });
      return;
    }

    commit(() => {
      setPhase("processing");
      setError(null);
      setProgress(`정규화 0 / ${list.length}`);
    });

    const names = uniqueSpriteNames(list.map((item) => toSpriteName(item.file.name)));
    let pixelLimited = false;
    const nextRecords: SpriteRecord[] = list.map((item, index) => ({
      ...item,
      spriteName: names[index] ?? "sprite",
      status: "queued",
      message: undefined,
      previewUrl: undefined,
    }));

    if (!alive()) return;
    setSources(nextRecords.map((record) => ({ ...record })));

    const packable: { name: string; canvas: HTMLCanvasElement }[] = [];
    for (let index = 0; index < list.length; index += 1) {
      if (!alive()) return;
      const total = list.length;
      setProgress(`정규화 ${index + 1} / ${total}`);
      const current = list[index];
      const spriteName = names[index] ?? "sprite";
      try {
        const normalized = await normalizeSprite(current.file, nextSettings);
        if (!alive()) return;
        nextRecords[index] = {
          ...nextRecords[index],
          status: normalized.empty ? "empty" : "ready",
          previewUrl: normalized.previewUrl,
          message: normalized.empty ? "완전히 투명해서 아틀라스에서 뺐습니다." : undefined,
          sourceWidth: normalized.sourceWidth,
          sourceHeight: normalized.sourceHeight,
        };
        if (!normalized.empty) {
          packable.push({ name: spriteName, canvas: normalized.canvas });
        }
      } catch (caught) {
        if (!alive()) return;
        const message = caught instanceof Error ? caught.message : "이 파일을 읽지 못했습니다.";
        if (message === PIXEL_ART_LIMIT_MESSAGE) pixelLimited = true;
        nextRecords[index] = {
          ...nextRecords[index],
          status: "error",
          message,
        };
      }
      if (!alive()) return;
      setSources(nextRecords.map((record) => ({ ...record })));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (!alive()) return;

    if (pixelLimited) setNotice(PIXEL_ART_LIMIT_MESSAGE);

    if (packable.length === 0) {
      if (packRef.current) URL.revokeObjectURL(packRef.current.previewUrl);
      commit(() => {
        setPack(null);
        setPhase("ready");
        setProgress("");
        setError(pixelLimited ? PIXEL_ART_LIMIT_MESSAGE : "불투명한 픽셀이 있는 이미지가 없습니다.");
      });
      return;
    }

    try {
      if (!alive()) return;
      setProgress("아틀라스 패킹 중…");
      const packed = packSprites(packable, nextSettings.padding, {
        forcePowerOfTwo: nextSettings.forcePowerOfTwo,
        bleed: nextSettings.bleed,
      });
      const blob = await canvasToPngBlob(packed.canvas);
      if (!alive()) return;
      const previewUrl = URL.createObjectURL(blob);
      if (packRef.current) URL.revokeObjectURL(packRef.current.previewUrl);
      const atlasDocument = buildAtlasDocument(packed, nextSettings);
      commit(() => {
        setPack({
          canvas: packed.canvas,
          previewUrl,
          width: packed.width,
          height: packed.height,
          sprites: packed.sprites,
          fill: packed.fill,
          document: atlasDocument,
        });
        setPhase("ready");
        setProgress("");
        setError(null);
      });
    } catch (caught) {
      if (!alive()) return;
      commit(() => {
        setPhase("error");
        setProgress("");
        setError(caught instanceof Error ? caught.message : "패킹에 실패했습니다.");
      });
    }
  }

  function addFiles(files: File[]) {
    clearDebounce();
    const { accepted: rasterFiles, message } = acceptRasterUploads(files);
    if (message) setNotice(message);
    else setNotice(null);

    const accepted: SpriteRecord[] = rasterFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
      spriteName: toSpriteName(file.name),
    }));

    if (accepted.length === 0) return;
    const next = [...sourcesRef.current, ...accepted];
    sourcesRef.current = next;
    setSources(next);
    void reprocess(next, settingsRef.current);
  }

  function removeSprite(id: string) {
    clearDebounce();
    const next = sourcesRef.current.filter((item) => item.id !== id);
    sourcesRef.current = next;
    setSources(next);
    void reprocess(next, settingsRef.current);
  }

  function clearSprites() {
    clearDebounce();
    sourcesRef.current = [];
    setSources([]);
    setNotice(null);
    void reprocess([], settingsRef.current);
  }

  function updateSettings(next: PackSettings) {
    settingsRef.current = next;
    setSettings(next);
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      void reprocess(sourcesRef.current, settingsRef.current);
    }, 120);
  }

  async function download() {
    const current = packRef.current;
    if (!current || phaseRef.current === "processing") return;
    setDownloading(true);
    try {
      await downloadSpritePack(current.canvas, current.document);
    } catch (caught) {
      commit(() => {
        setError(caught instanceof Error ? caught.message : "ZIP을 만들지 못했습니다.");
      });
    } finally {
      commit(() => setDownloading(false));
    }
  }

  return {
    sources,
    settings,
    phase,
    progress,
    error,
    notice,
    pack,
    downloading,
    addFiles,
    removeSprite,
    clearSprites,
    updateSettings,
    download,
    dismissNotice: () => setNotice(null),
  };
}
