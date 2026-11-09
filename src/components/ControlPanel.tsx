"use client";

import { Crosshair, Scissors, SlidersHorizontal } from "lucide-react";
import { GhostPixelToggle } from "@/components/GhostPixelToggle";
import { ORIGINAL_TILE_SIZE, TILE_SIZES, type PackSettings, type TileSize } from "@/lib/types";

type Props = {
  settings: PackSettings;
  onChange: (next: PackSettings) => void;
};

export function ControlPanel({ settings, onChange }: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-[#e39b4b]" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide text-[#ece7df]">정규화</h2>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">타일 규격</legend>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="타일 규격">
          {TILE_SIZES.map((size) => {
            const selected = settings.tileSize === size;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...settings, tileSize: size satisfies TileSize })}
                className={`h-12 rounded-lg border text-sm font-medium tabular-nums transition ${
                  selected
                    ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                    : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
                }`}
              >
                {size}×{size}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={settings.tileSize === ORIGINAL_TILE_SIZE}
            aria-label="Original (비율 유지)"
            onClick={() => onChange({ ...settings, tileSize: ORIGINAL_TILE_SIZE })}
            className={`h-12 rounded-lg border text-sm font-medium transition ${
              settings.tileSize === ORIGINAL_TILE_SIZE
                ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
            }`}
          >
            <span className="block leading-tight">Original</span>
            <span className="block text-[10px] font-normal tracking-normal opacity-80">비율 유지</span>
          </button>
        </div>
        {settings.tileSize === ORIGINAL_TILE_SIZE ? (
          <p className="mt-2 text-xs leading-5 text-[#6f788a]">
            {settings.trimAlpha
              ? "정사각으로 늘리지 않습니다. 알파 트림만 한 뒤 원본 해상도 비율 그대로 패킹합니다."
              : "정사각으로 늘리지 않습니다. 트림이 꺼져 있어 원본 캔버스 비율 그대로 패킹합니다."}
          </p>
        ) : null}
      </fieldset>

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-3">
        <span>
          <span className="block text-sm font-medium text-[#ece7df]">Force Power of Two (GPU 호환)</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#9aa3b5]">
            potpack 결과의 가로·세로를 내용이 들어가는 가장 가까운 2의 거듭제곱 캔버스로 확장합니다.
          </span>
        </span>
        <input
          type="checkbox"
          checked={settings.forcePowerOfTwo}
          onChange={(event) => onChange({ ...settings, forcePowerOfTwo: event.target.checked })}
          className="size-4 shrink-0 accent-[#e39b4b]"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-3">
        <div className="flex items-start gap-2">
          <Scissors className="mt-0.5 size-4 text-[#8ee0c6]" aria-hidden />
          <div>
            <p className="text-sm font-medium text-[#ece7df]">여백 트림</p>
            <p className="text-xs text-[#9aa3b5]">Auto Trim Alpha</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.trimAlpha}
          aria-label="여백 트림 Auto Trim Alpha"
          onClick={() => onChange({ ...settings, trimAlpha: !settings.trimAlpha })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            settings.trimAlpha ? "bg-[#8ee0c6]" : "bg-[#343b4a]"
          }`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-[#101318] transition ${
              settings.trimAlpha ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <GhostPixelToggle
        checked={settings.cleanGhostPixels}
        onChange={(cleanGhostPixels) => onChange({ ...settings, cleanGhostPixels })}
      />

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-3">
        <span>
          <span className="block text-sm font-medium text-[#ece7df]">1px Bleed (타일맵 틈새 방지)</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#9aa3b5]">
            각 조각의 가장자리 색을 상하좌우와 네 모서리로 1px Clamp 복제합니다. 스프라이트 사각은 내용만 가리킵니다.
          </span>
        </span>
        <input
          type="checkbox"
          checked={settings.bleed}
          onChange={(event) => onChange({ ...settings, bleed: event.target.checked })}
          className="size-4 shrink-0 accent-[#e39b4b]"
        />
      </label>

      <label className="mt-4 block" htmlFor="padding">
        <span className="mb-2 flex items-center justify-between text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">
          패딩
          <span className="font-mono text-sm tracking-normal text-[#ece7df] normal-case">{settings.padding}px</span>
        </span>
        <input
          id="padding"
          type="range"
          min={0}
          max={4}
          step={1}
          value={settings.padding}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={settings.padding}
          aria-valuetext={`${settings.padding}픽셀`}
          onChange={(event) => onChange({ ...settings, padding: Number(event.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3140] accent-[#e39b4b]"
        />
        <span className="mt-1 flex justify-between font-mono text-[10px] text-[#6f788a]">
          <span>0</span>
          <span>4</span>
        </span>
      </label>

      <fieldset className="mt-4">
        <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">
          <Crosshair className="size-3.5" aria-hidden />
          샘플링
        </legend>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="샘플링">
          <button
            type="button"
            role="radio"
            aria-checked={!settings.pixelated}
            onClick={() => onChange({ ...settings, pixelated: false })}
            className={`h-10 rounded-lg border text-sm transition ${
              !settings.pixelated
                ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
            }`}
          >
            부드럽게
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.pixelated}
            onClick={() => onChange({ ...settings, pixelated: true })}
            className={`h-10 rounded-lg border text-sm transition ${
              settings.pixelated
                ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
            }`}
          >
            최근접
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#6f788a]">
          미드저니 컷은 부드럽게, 픽셀랩 컷은 최근접이 가장자리를 유지합니다.
        </p>
      </fieldset>
    </section>
  );
}
