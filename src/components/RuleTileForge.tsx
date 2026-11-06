"use client";

import { Grid3x3, X } from "lucide-react";
import { useState } from "react";
import { DropZone } from "@/components/DropZone";
import { RuleTilePreview } from "@/components/RuleTilePreview";
import { useRuleTileForge } from "@/hooks/useRuleTileForge";
import {
  DIRECTION_KEYS,
  PRESET_INFO,
  RULE_PRESETS,
  RULE_TILE_SIZES,
  type NeighborValue,
  type Neighbors,
  type RulePreset,
  type RuleTileSize,
} from "@/lib/ruleTile";

export function RuleTileForge() {
  const forge = useRuleTileForge();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const preset = PRESET_INFO[forge.preset];
  const data = forge.analysis?.data ?? null;
  const previewError = forge.error ?? forge.analysis?.error ?? null;

  return (
    <div className="flex flex-col gap-6">
      {forge.notice ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#6a5438] bg-[#23190f] px-3 py-2 text-sm text-[#f3d2a8]">
          <p>{forge.notice}</p>
          <button
            type="button"
            onClick={forge.dismissNotice}
            aria-label="알림 닫기"
            className="rounded-md p-1 text-[#f3d2a8] hover:bg-[#3a2a18]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <div className="mb-4 flex items-center gap-2">
              <Grid3x3 className="size-4 text-[#e39b4b]" aria-hidden />
              <h2 className="text-sm font-semibold tracking-wide text-[#ece7df]">룰 매핑</h2>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">레이아웃 프리셋</legend>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="레이아웃 프리셋">
                {RULE_PRESETS.map((id) => {
                  const info = PRESET_INFO[id];
                  const selected = forge.preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => forge.setPreset(id satisfies RulePreset)}
                      className={`h-12 rounded-lg border px-1 text-xs font-medium transition sm:text-sm ${
                        selected
                          ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                          : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
                      }`}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6f788a]">{preset.hint}</p>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">타일 단위 크기</legend>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="타일 단위 크기">
                {RULE_TILE_SIZES.map((size) => {
                  const selected = forge.tileSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => forge.setTileSize(size satisfies RuleTileSize)}
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
              </div>
            </fieldset>
          </section>

          <DropZone
            multiple={false}
            title="타일셋 PNG를 떨어뜨리거나 클릭"
            hint="시트 한 장만 올립니다. 칸 나누기와 RuleData.json은 이 브라우저에서 만듭니다."
            onFiles={(files) => {
              setActiveIndex(null);
              void forge.addFiles(files);
            }}
          />

          {forge.file ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-2">
              <p className="truncate text-xs text-[#c5cbd6]" title={forge.file.name}>
                {forge.file.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex(null);
                  forge.clearSheet();
                }}
                className="shrink-0 text-xs text-[#9aa3b5] hover:text-[#ece7df]"
              >
                지우기
              </button>
            </div>
          ) : null}

          <RuleTable
            rules={data?.rules ?? []}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            summary={
              data
                ? `룰 ${data.rules.length}개 · 기본 스프라이트 ${data.cells.find((cell) => cell.index === data.defaultSpriteIndex)?.sprite ?? ""} · 조건이 많은 룰부터 검사`
                : "시트가 프리셋과 맞으면 8방향 조건이 여기에 나옵니다."
            }
          />
        </div>

        <RuleTilePreview
          previewUrl={forge.previewUrl}
          width={forge.imageSize?.width ?? 0}
          height={forge.imageSize?.height ?? 0}
          tileSize={forge.tileSize}
          cells={forge.analysis?.cells ?? []}
          activeIndex={activeIndex}
          loading={forge.loading}
          downloading={forge.downloading}
          canDownload={Boolean(data)}
          error={previewError}
          warning={forge.analysis?.warning ?? null}
          onDownload={() => {
            void forge.download();
          }}
        />
      </div>
    </div>
  );
}

function RuleTable({
  rules,
  activeIndex,
  onSelect,
  summary,
}: {
  rules: { index: number; label: string; sprite: string; neighbors: Neighbors }[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
  summary: string;
}) {
  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
      <h2 className="text-sm font-semibold text-[#ece7df]">8방향 룰</h2>
      <p className="mt-1 text-xs leading-5 text-[#9aa3b5]">{summary}</p>
      <p className="mt-2 text-[10px] tracking-wide text-[#6f788a] uppercase">
        0 무시 · 1 같은 타일 · 2 다른 타일
      </p>
      {rules.length === 0 ? null : (
        <ol className="mt-3 flex max-h-80 flex-col gap-1.5 overflow-auto pr-1">
          {rules.map((rule, order) => {
            const selected = rule.index === activeIndex;
            return (
              <li key={`${rule.index}-${order}`}>
                <button
                  type="button"
                  onClick={() => onSelect(rule.index)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition ${
                    selected
                      ? "border-[#8ee0c6]/60 bg-[#8ee0c6]/10"
                      : "border-[#2a3140] bg-[#0d1016] hover:border-[#465066]"
                  }`}
                >
                  <span className="w-8 shrink-0 text-center font-mono text-sm text-[#f3d2a8]">{rule.index}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[#ece7df]">{rule.label}</span>
                    <span className="block truncate font-mono text-[10px] text-[#6f788a]">
                      {order + 1}번째 검사 · {rule.sprite}
                    </span>
                  </span>
                  <NeighborGrid neighbors={rule.neighbors} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function NeighborGrid({ neighbors }: { neighbors: Neighbors }) {
  const cells: (NeighborValue | "center")[] = [
    neighbors.TopLeft,
    neighbors.Top,
    neighbors.TopRight,
    neighbors.Left,
    "center",
    neighbors.Right,
    neighbors.BottomLeft,
    neighbors.Bottom,
    neighbors.BottomRight,
  ];
  return (
    <span className="grid w-14 shrink-0 grid-cols-3 gap-px" aria-label={neighborSummary(neighbors)}>
      {cells.map((value, index) => (
        <span
          key={index}
          className={`flex h-4 items-center justify-center rounded-[2px] font-mono text-[9px] ${
            value === "center"
              ? "bg-[#e39b4b] text-[#1a1208]"
              : value === 1
                ? "bg-[#14352c] text-[#8ee0c6]"
                : value === 2
                  ? "bg-[#3a1c22] text-[#ffb4b8]"
                  : "bg-[#1a1f29] text-[#6f788a]"
          }`}
        >
          {value === "center" ? "·" : value}
        </span>
      ))}
    </span>
  );
}

function neighborSummary(neighbors: Neighbors): string {
  return DIRECTION_KEYS.map((key) => `${key} ${neighbors[key]}`).join(", ");
}
