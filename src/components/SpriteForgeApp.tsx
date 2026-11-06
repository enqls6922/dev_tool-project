"use client";

import { Anvil, ChevronRight, ShieldCheck } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { RuleTileForge } from "@/components/RuleTileForge";
import { SpritePackerPanel } from "@/components/SpritePackerPanel";

const TABS = [
  {
    id: "packer",
    label: "📦 Sprite Packer",
    panel: "panel-packer",
    steps: ["Drop Sprites", "Auto Trim & Grid", "Export Unity Pack (.zip)"],
    summary: "Turn messy AI pixel art into clean, Unity-ready sprite atlases in seconds.",
  },
  {
    id: "ruletile",
    label: "🗺️ RuleTile Forge",
    panel: "panel-ruletile",
    steps: ["Tileset PNG", "Preset & Tile Size", "Export RuleTile Pack (.zip)"],
    summary: "PixelLab 타일셋을 Unity Rule Tile로 바꿉니다. 8방향 이웃 조건과 에디터 빌더를 같이 담습니다.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SpriteForgeApp() {
  const [tab, setTab] = useState<TabId>("packer");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ packer: null, ruletile: null });
  const active = TABS.find((item) => item.id === tab) ?? TABS[0];

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9aa3b5]">{active.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div role="tablist" aria-label="SpriteForge 작업" className="flex flex-wrap gap-1 rounded-xl border border-[#2a3140] bg-[#0d1016] p-1">
                  {TABS.map((item, index) => {
                    const selected = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        ref={(node) => {
                          tabRefs.current[item.id] = node;
                        }}
                        type="button"
                        role="tab"
                        id={`tab-${item.id}`}
                        aria-selected={selected}
                        aria-controls={item.panel}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setTab(item.id)}
                        onKeyDown={(event) => onTabKey(event, index)}
                        className={`h-10 rounded-lg px-3 text-sm font-medium transition ${
                          selected
                            ? "bg-[#e39b4b] text-[#1a1208]"
                            : "text-[#c5cbd6] hover:bg-[#1a1f29] hover:text-[#ece7df]"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Workflow">
                {active.steps.map((step, index) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#6a5438] bg-[#23190f] px-3 py-1.5 text-xs font-medium text-[#f3d2a8]">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#e39b4b] font-mono text-[11px] font-semibold text-[#1a1208]">
                        {index + 1}
                      </span>
                      {step}
                    </span>
                    {index < active.steps.length - 1 ? (
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

        <div
          role="tabpanel"
          id="panel-packer"
          aria-labelledby="tab-packer"
          hidden={tab !== "packer"}
        >
          <SpritePackerPanel />
        </div>
        <div
          role="tabpanel"
          id="panel-ruletile"
          aria-labelledby="tab-ruletile"
          hidden={tab !== "ruletile"}
        >
          <RuleTileForge />
        </div>
      </div>
    </div>
  );
}
