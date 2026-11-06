"use client";

import { Anvil, ChevronRight, ShieldCheck, X } from "lucide-react";
import { AtlasPreview } from "@/components/AtlasPreview";
import { ControlPanel } from "@/components/ControlPanel";
import { DropZone } from "@/components/DropZone";
import { SpriteGrid } from "@/components/SpriteGrid";
import { useSpriteForge } from "@/hooks/useSpriteForge";

const STEPS = ["Drop Sprites", "Auto Trim & Grid", "Export Unity Pack (.zip)"] as const;

export function SpriteForgeApp() {
  const forge = useSpriteForge();

  return (
    <div className="forge-grid min-h-full flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-4 border-b border-[#2a3140] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#6a5438] bg-[#23190f] text-[#e39b4b]">
              <Anvil className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#ece7df] sm:text-3xl">SpriteForge</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9aa3b5]">
                Turn messy AI pixel art into clean, Unity-ready sprite atlases in seconds.
              </p>
              <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Workflow">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#6a5438] bg-[#23190f] px-3 py-1.5 text-xs font-medium text-[#f3d2a8]">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#e39b4b] font-mono text-[11px] font-semibold text-[#1a1208]">
                        {index + 1}
                      </span>
                      {step}
                    </span>
                    {index < STEPS.length - 1 ? (
                      <ChevronRight className="size-4 shrink-0 text-[#6f788a]" aria-hidden />
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#2a3140] bg-[#13171f] px-3 py-1.5 text-xs text-[#c5cbd6]">
            <ShieldCheck className="size-3.5 text-[#8ee0c6]" aria-hidden />
            브라우저 전용 · 서버 업로드 없음
          </p>
        </header>

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
            <ControlPanel settings={forge.settings} onChange={forge.updateSettings} />
            <DropZone onFiles={forge.addFiles} />
            <SpriteGrid
              sprites={forge.sources}
              pixelated={forge.settings.pixelated}
              onRemove={forge.removeSprite}
              onClear={forge.clearSprites}
            />
          </div>
          <AtlasPreview
            pack={forge.pack}
            fileCount={forge.sources.length}
            phase={forge.phase}
            progress={forge.progress}
            error={forge.error}
            pixelated={forge.settings.pixelated}
            downloading={forge.downloading}
            onDownload={() => {
              void forge.download();
            }}
          />
        </div>
      </div>
    </div>
  );
}
