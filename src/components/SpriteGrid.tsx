"use client";

import { Trash2, X } from "lucide-react";
import type { SpriteRecord } from "@/lib/types";

type Props = {
  sprites: SpriteRecord[];
  pixelated: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function SpriteGrid({ sprites, pixelated, onRemove, onClear }: Props) {
  if (sprites.length === 0) {
    return (
      <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/80 px-4 py-6 text-sm text-[#9aa3b5]">
        아직 올린 스프라이트가 없습니다. 투명 여백이 들쭉날쭉한 PNG를 올리면 정규화된 타일이 여기 나타납니다.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#ece7df]">
          낱개 타일
          <span className="ml-2 font-mono text-xs font-normal text-[#9aa3b5]">{sprites.length}</span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df]"
        >
          <Trash2 className="size-3.5" aria-hidden />
          모두 제거
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {sprites.map((sprite) => (
          <li key={sprite.id} className="min-w-0">
            <div
              className={`checkerboard relative aspect-square overflow-hidden rounded-lg border ${
                sprite.status === "error"
                  ? "border-[#f07178]"
                  : sprite.status === "empty"
                    ? "border-[#6a5438]"
                    : "border-[#2a3140]"
              }`}
            >
              {sprite.previewUrl ? (
                // Blob and data URLs from the local canvas are not next/image sources.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sprite.previewUrl}
                  alt={sprite.spriteName}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: pixelated ? "pixelated" : "auto" }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] tracking-wide text-[#9aa3b5] uppercase">
                  {sprite.status === "error" ? "error" : "…"}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(sprite.id)}
                aria-label={`${sprite.spriteName} 제거`}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-[#0d1016]/85 text-[#ece7df] transition hover:bg-[#f07178] hover:text-[#1a0c0e]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <p className="mt-1.5 truncate text-xs text-[#ece7df]" title={sprite.file.name}>
              {sprite.spriteName}
            </p>
            <p className="truncate text-[10px] text-[#6f788a]">
              {sprite.message
                ? sprite.message
                : sprite.sourceWidth && sprite.sourceHeight
                  ? `${sprite.sourceWidth}×${sprite.sourceHeight}`
                  : sprite.file.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
