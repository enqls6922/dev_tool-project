"use client";

import { Download, LoaderCircle, Rows3 } from "lucide-react";
import { useState } from "react";
import type { PreviewPack } from "@/hooks/useSpriteForge";

type Props = {
  pack: PreviewPack | null;
  fileCount: number;
  phase: "idle" | "processing" | "ready" | "error";
  progress: string;
  error: string | null;
  pixelated: boolean;
  downloading: boolean;
  onDownload: () => void;
};

export function AtlasPreview({
  pack,
  fileCount,
  phase,
  progress,
  error,
  pixelated,
  downloading,
  onDownload,
}: Props) {
  const [guides, setGuides] = useState(true);
  const packedCount = pack?.sprites.length ?? 0;
  const displayScale = pack ? (pack.width < 280 ? Math.min(4, Math.max(1, Math.floor(280 / pack.width))) : 1) : 1;
  const busy = phase === "processing";

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] lg:sticky lg:top-16">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#ece7df]">아틀라스 프리뷰</h2>
          <p className="mt-1 text-xs text-[#9aa3b5]">체커보드가 투명 픽셀입니다.</p>
        </div>
        {pack ? (
          <button
            type="button"
            onClick={() => setGuides((value) => !value)}
            aria-pressed={guides}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
              guides
                ? "border-[#e39b4b]/50 bg-[#e39b4b]/10 text-[#f3d2a8]"
                : "border-[#2a3140] text-[#9aa3b5] hover:text-[#ece7df]"
            }`}
          >
            <Rows3 className="size-3.5" aria-hidden />
            슬라이스
          </button>
        ) : null}
      </div>

      <div className="checkerboard relative max-h-[min(70vh,640px)] overflow-auto rounded-xl border border-[#2a3140]">
        {pack ? (
          <div
            className={`relative inline-block ${busy ? "opacity-60" : ""}`}
            style={{ width: pack.width * displayScale }}
          >
            {/* Local atlas blob. next/image cannot take an object URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pack.previewUrl}
              alt={`패킹된 스프라이트 시트 ${pack.width}×${pack.height}`}
              width={pack.width}
              height={pack.height}
              className="block h-auto max-w-none"
              style={{
                width: pack.width * displayScale,
                height: pack.height * displayScale,
                imageRendering: pixelated || displayScale > 1 ? "pixelated" : "auto",
              }}
            />
            {guides
              ? pack.sprites.map((sprite) => (
                  <div
                    key={`${sprite.name}-${sprite.x}-${sprite.y}`}
                    title={sprite.name}
                    className="pointer-events-none absolute box-border border border-[#e39b4b]/80"
                    style={{
                      left: `${(sprite.x / pack.width) * 100}%`,
                      top: `${(sprite.y / pack.height) * 100}%`,
                      width: `${(sprite.width / pack.width) * 100}%`,
                      height: `${(sprite.height / pack.height) * 100}%`,
                    }}
                  />
                ))
              : null}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#ece7df]">시트가 여기에 그려집니다.</p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#9aa3b5]">
              타일 크기, 트림, 블리드, 패딩을 바꾸면 미리보기가 다시 패킹됩니다.
            </p>
          </div>
        )}
        {busy ? (
          <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border border-[#2a3140] bg-[#0d1016]/90 px-3 py-1.5 text-xs text-[#ece7df]">
            <LoaderCircle className="size-3.5 animate-spin text-[#e39b4b]" aria-hidden />
            <span role="status">{progress || "처리 중"}</span>
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Kpi label="이미지 수" value={pack ? String(packedCount) : fileCount ? "0" : "—"} hint={fileCount ? `파일 ${fileCount}` : "파일 0"} />
        <Kpi label="아틀라스" value={pack ? `${pack.width}×${pack.height}` : "—"} hint="px" />
        <Kpi label="채움" value={pack ? `${Math.round(pack.fill * 100)}%` : "—"} hint="타일 면적" />
      </dl>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-[#f07178]/40 bg-[#f07178]/10 px-3 py-2 text-xs leading-5 text-[#ffc1c4]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onDownload}
        disabled={!pack || busy || downloading}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e39b4b] text-sm font-semibold text-[#1a1208] transition hover:bg-[#f0b36a] disabled:cursor-not-allowed disabled:bg-[#3a332b] disabled:text-[#8d8174]"
      >
        {downloading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        SpritePack.zip 다운로드
      </button>

      <details className="mt-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-2 text-xs leading-5 text-[#9aa3b5]">
        <summary className="cursor-pointer text-[#c5cbd6]">Unity에서 슬라이스하는 법</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>SpritePack.zip을 풀어 Assets 폴더에 넣습니다. Editor/SpriteSheetImporter.cs 가 함께 들어 있습니다.</li>
          <li>Atlas.png를 선택합니다.</li>
          <li>Tools → SpriteForge → Slice Selected Atlas 를 실행합니다.</li>
        </ol>
        <p className="mt-2">
          JSON 좌표는 왼쪽 위 원점이고, 임포터는 Unity의 왼쪽 아래 원점으로 Y를 뒤집습니다. 피벗은 중앙입니다.
        </p>
      </details>
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[#2a3140] bg-[#0d1016] px-2.5 py-2">
      <dt className="text-[10px] tracking-wide text-[#6f788a] uppercase">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm text-[#8ee0c6]" title={value}>
        {value}
      </dd>
      <p className="truncate text-[10px] text-[#6f788a]">{hint}</p>
    </div>
  );
}
