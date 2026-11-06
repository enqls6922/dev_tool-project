"use client";

import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import type { SheetCell } from "@/lib/ruleTile";

type Props = {
  previewUrl: string | null;
  width: number;
  height: number;
  tileSize: number;
  cells: SheetCell[];
  activeIndex: number | null;
  loading: boolean;
  downloading: boolean;
  canDownload: boolean;
  error: string | null;
  warning: string | null;
  onDownload: () => void;
};

export function RuleTilePreview({
  previewUrl,
  width,
  height,
  tileSize,
  cells,
  activeIndex,
  loading,
  downloading,
  canDownload,
  error,
  warning,
  onDownload,
}: Props) {
  const displayScale = width > 0 ? Math.max(1, Math.min(6, Math.floor(560 / width))) : 1;
  const columns = tileSize > 0 ? width / tileSize : 0;

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] lg:sticky lg:top-16">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#ece7df]">타일셋 프리뷰</h2>
        <p className="mt-1 text-xs leading-5 text-[#9aa3b5]">
          격자 위의 번호가 슬라이스 인덱스입니다. 0번부터 왼쪽 위, 가로 방향입니다.
        </p>
      </div>

      <div className="checkerboard relative max-h-[min(70vh,640px)] overflow-auto rounded-xl border border-[#2a3140]">
        {previewUrl && width > 0 ? (
          <div className="relative inline-block" style={{ width: width * displayScale }}>
            {/* Local tileset blob. next/image cannot take an object URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`타일셋 시트 ${width}×${height}, 칸 ${tileSize}px`}
              width={width}
              height={height}
              className="block h-auto max-w-none"
              style={{
                width: width * displayScale,
                height: height * displayScale,
                imageRendering: "pixelated",
              }}
            />
            {cells.map((cell) => {
              const active = cell.index === activeIndex;
              return (
                <div
                  key={cell.index}
                  className={`pointer-events-none absolute box-border border ${
                    active ? "border-[#8ee0c6] bg-[#8ee0c6]/15" : "border-[#e39b4b]/80"
                  }`}
                  style={{
                    left: `${(cell.x / width) * 100}%`,
                    top: `${(cell.y / height) * 100}%`,
                    width: `${(cell.width / width) * 100}%`,
                    height: `${(cell.height / height) * 100}%`,
                  }}
                >
                  <span className="absolute top-0.5 left-0.5 rounded bg-[#090b10]/85 px-1 font-mono text-[10px] leading-4 text-[#f3d2a8]">
                    {cell.index}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#ece7df]">시트가 여기에 그려집니다.</p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#9aa3b5]">
              PNG를 올리면 타일 칸과 인덱스 번호가 겹쳐 보입니다.
            </p>
          </div>
        )}
        {loading ? (
          <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border border-[#2a3140] bg-[#0d1016]/90 px-3 py-1.5 text-xs text-[#ece7df]">
            <LoaderCircle className="size-3.5 animate-spin text-[#e39b4b]" aria-hidden />
            <span role="status">시트 읽는 중</span>
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="시트" value={width > 0 ? `${width}×${height}` : "—"} hint="px" />
        <Stat label="칸" value={columns > 0 ? `${columns}×${height / tileSize}` : "—"} hint={`${tileSize}px`} />
        <Stat label="타일" value={cells.length > 0 ? String(cells.length) : "—"} hint="인덱스" />
      </dl>

      {warning ? (
        <p className="mt-3 rounded-lg border border-[#6a5438] bg-[#23190f] px-3 py-2 text-xs leading-5 text-[#f3d2a8]">
          {warning}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-[#f07178]/40 bg-[#f07178]/10 px-3 py-2 text-xs leading-5 text-[#ffc1c4]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onDownload}
        disabled={!canDownload || downloading || loading}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e39b4b] text-sm font-semibold text-[#1a1208] transition hover:bg-[#f0b36a] disabled:cursor-not-allowed disabled:bg-[#3a332b] disabled:text-[#8d8174]"
      >
        {downloading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        RuleTilePack.zip 다운로드
      </button>

      <details
        open
        className="group mt-3 overflow-hidden rounded-xl border border-[#6a5438] bg-[#1c160f] text-xs leading-5 text-[#c5cbd6]"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-[#f3d2a8] [&::-webkit-details-marker]:hidden">
          <span>📌 유니티에 1초 만에 적용하는 법</span>
          <ChevronDown className="size-4 shrink-0 text-[#e39b4b] transition group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="space-y-2.5 border-t border-[#6a5438]/80 px-3 py-3">
          <li className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e39b4b] font-mono text-[11px] font-semibold text-[#1a1208]">
              1
            </span>
            <span>다운로드받은 파일들을 유니티 Assets 폴더(권장: Assets/Editor)에 넣기</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e39b4b] font-mono text-[11px] font-semibold text-[#1a1208]">
              2
            </span>
            <span>유니티에서 Tileset.png를 우클릭하고 [SpriteForge &gt; Build Rule Tile] 클릭</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e39b4b] font-mono text-[11px] font-semibold text-[#1a1208]">
              3
            </span>
            <span>생성된 완성형 RuleTile(.asset)을 타일 팔레트에 넣고 브러시로 칠하기!</span>
          </li>
        </ol>
      </details>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
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
