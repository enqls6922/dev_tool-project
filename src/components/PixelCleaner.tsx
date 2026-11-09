"use client";

import { Download, LoaderCircle, Trash2, X } from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { usePixelCleaner, type CleanerItem, type CleanerZoom } from "@/hooks/usePixelCleaner";

export function PixelCleaner() {
  const cleaner = usePixelCleaner();
  const readyCount = cleaner.items.filter((item) => item.status === "ready").length;

  return (
    <div className="flex flex-col gap-4">
      {cleaner.notice ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#6a5438] bg-[#23190f] px-3 py-2 text-sm text-[#f3d2a8]">
          <p>{cleaner.notice}</p>
          <button
            type="button"
            onClick={cleaner.dismissNotice}
            aria-label="알림 닫기"
            className="rounded-md p-1 text-[#f3d2a8] hover:bg-[#3a2a18]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <DropZone
        title="PNG, JPG, WebP를 떨어뜨리거나 클릭"
        hint="한 장 또는 여러 장. 알파가 0보다 크고 30보다 작은 고스트 픽셀의 RGBA를 지운 뒤 Before / After로 경계를 확인합니다."
        onFiles={(files) => {
          void cleaner.addFiles(files);
        }}
      />

      {cleaner.busy ? (
        <p role="status" className="inline-flex items-center gap-2 text-xs text-[#c5cbd6]">
          <LoaderCircle className="size-3.5 animate-spin text-[#e39b4b]" aria-hidden />
          {cleaner.progress || "청소 중"}
        </p>
      ) : null}

      {cleaner.items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-3 sm:flex-row sm:items-center sm:justify-between">
          <fieldset>
            <legend className="mb-2 text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">확대</legend>
            <div className="flex gap-1.5" role="radiogroup" aria-label="확대 배율">
              {cleaner.zooms.map((scale) => {
                const selected = cleaner.zoom === scale;
                return (
                  <button
                    key={scale}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => cleaner.setZoom(scale)}
                    className={`h-9 rounded-lg border px-3 font-mono text-sm transition ${
                      selected
                        ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                        : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
                    }`}
                  >
                    {scale}×
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={cleaner.clearItems}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#2a3140] px-3 text-xs text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df]"
            >
              <Trash2 className="size-3.5" aria-hidden />
              모두 제거
            </button>
            <button
              type="button"
              onClick={() => {
                void cleaner.downloadZip();
              }}
              disabled={readyCount === 0 || cleaner.zipping}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e39b4b] px-3 text-xs font-semibold text-[#1a1208] transition hover:bg-[#f0b36a] disabled:cursor-not-allowed disabled:bg-[#3a332b] disabled:text-[#8d8174]"
            >
              {cleaner.zipping ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="size-3.5" aria-hidden />
              )}
              ZIP 다운로드
            </button>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col gap-4">
        {cleaner.items.map((item) => (
          <CleanerCard
            key={item.id}
            item={item}
            zoom={cleaner.zoom}
            onDownload={() => cleaner.downloadOne(item.id)}
            onRemove={() => cleaner.removeItem(item.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function CleanerCard({
  item,
  zoom,
  onDownload,
  onRemove,
}: {
  item: CleanerItem;
  zoom: CleanerZoom;
  onDownload: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[#ece7df]" title={item.name}>
            {item.name}
          </h2>
          <p className="mt-1 text-xs text-[#9aa3b5]">
            {item.status === "error"
              ? item.message
              : `${item.width}×${item.height} · 고스트 픽셀 ${(item.removed ?? 0).toLocaleString("ko-KR")}개 제거`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.status === "ready" ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#6a5438] bg-[#23190f] px-2.5 text-xs font-medium text-[#f3d2a8] transition hover:bg-[#3a2a18]"
            >
              <Download className="size-3.5" aria-hidden />
              PNG
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${item.name} 제거`}
            className="flex size-9 items-center justify-center rounded-lg text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {item.status === "ready" && item.beforeUrl && item.afterUrl && item.width && item.height ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ComparePane label="Before" url={item.beforeUrl} name={item.name} width={item.width} height={item.height} zoom={zoom} />
          <ComparePane label="After" url={item.afterUrl} name={item.name} width={item.width} height={item.height} zoom={zoom} />
        </div>
      ) : null}
    </li>
  );
}

function ComparePane({
  label,
  url,
  name,
  width,
  height,
  zoom,
}: {
  label: "Before" | "After";
  url: string;
  name: string;
  width: number;
  height: number;
  zoom: number;
}) {
  return (
    <figure>
      <figcaption className="mb-1.5 text-[11px] font-medium tracking-wide text-[#9aa3b5] uppercase">{label}</figcaption>
      <div className="max-h-72 overflow-auto rounded-xl border border-[#2a3140]">
        <div className="checkerboard inline-block">
          {/* Local canvas blob. next/image cannot take an object URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${name} ${label}`}
            width={width}
            height={height}
            className="block max-w-none"
            style={{
              width: width * zoom,
              height: height * zoom,
              imageRendering: "pixelated",
            }}
          />
        </div>
      </div>
    </figure>
  );
}
