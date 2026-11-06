"use client";

import { Anvil, ChevronRight, ShieldCheck } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { MotionStabilizer } from "@/components/MotionStabilizer";
import { PixelCleaner } from "@/components/PixelCleaner";
import { RuleTileForge } from "@/components/RuleTileForge";
import { SpritePackerPanel } from "@/components/SpritePackerPanel";

const TABS = [
  {
    id: "packer",
    label: "📦 Sprite Packer",
    panel: "panel-packer",
    steps: ["Drop Sprites", "Trim & Grid", "Export ZIP"],
    summary: "Turn messy AI pixel art into clean, Unity-ready sprite atlases in seconds.",
  },
  {
    id: "ruletile",
    label: "🗺️ RuleTile Forge",
    panel: "panel-ruletile",
    steps: ["Tileset PNG", "Preset", "Export ZIP"],
    summary: "PixelLab 타일셋을 Unity Rule Tile로 바꿉니다. 8방향 이웃 조건과 에디터 빌더를 같이 담습니다.",
  },
  {
    id: "cleaner",
    label: "🧹 Pixel Cleaner",
    panel: "panel-cleaner",
    steps: ["Drop PNG", "Clean Alpha", "Save PNG"],
    summary: "반투명 고스트 픽셀을 지우고, 확대 체커보드에서 정리된 경계를 확인합니다.",
  },
  {
    id: "motion",
    label: "🎬 Motion Stabilizer",
    panel: "panel-motion",
    steps: ["Drop Frames", "Stabilize", "Export Sheet"],
    summary: "걷기 프레임의 발바닥을 한 기준선에 맞추고, 좌우 중심을 고정한 뒤 가로 스트립으로 내보냅니다.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SpriteForgeApp() {
  const [tab, setTab] = useState<TabId>("packer");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    packer: null,
    ruletile: null,
    cleaner: null,
    motion: null,
  });
  const active = TABS.find((item) => item.id === tab) ?? TABS[0];

  const selectTab = (id: TabId) => {
    setTab(id);
    tabRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="forge-grid min-h-full flex-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#6a5438] bg-[#23190f] text-[#e39b4b]">
              <Anvil className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-[#ece7df] sm:text-2xl">SpriteForge</h1>
                <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#2a3140] bg-[#13171f] px-2.5 py-1 text-[11px] text-[#c5cbd6]">
                  <ShieldCheck className="size-3.5 text-[#8ee0c6]" aria-hidden />
                  브라우저 전용 · 서버 업로드 없음
                </p>
              </div>
              <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm leading-5 text-[#9aa3b5]">{active.summary}</p>
            </div>
          </div>
          <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto" aria-label="Workflow">
            {active.steps.map((step, index) => (
              <li key={step} className="flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6a5438]/80 bg-[#23190f] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-[#f3d2a8]">
                  <span className="font-mono text-[10px] text-[#e39b4b]">{index + 1}</span>
                  {step}
                </span>
                {index < active.steps.length - 1 ? (
                  <ChevronRight className="size-3 shrink-0 text-[#6f788a]" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </header>

        <div className="sticky top-0 z-30 -mx-4 border-b border-[#2a3140] bg-[#090b10] sm:-mx-6">
          <div role="tablist" aria-label="SpriteForge 작업" className="no-scrollbar flex overflow-x-auto px-2">
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
                  onClick={() => selectTab(item.id)}
                  onKeyDown={(event) => onTabKey(event, index)}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e39b4b] ${
                    selected
                      ? "border-[#e39b4b] text-[#f3d2a8]"
                      : "border-transparent text-[#9aa3b5] hover:text-[#ece7df]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div role="tabpanel" id="panel-packer" aria-labelledby="tab-packer" hidden={tab !== "packer"}>
          <SpritePackerPanel />
        </div>
        <div role="tabpanel" id="panel-ruletile" aria-labelledby="tab-ruletile" hidden={tab !== "ruletile"}>
          <RuleTileForge />
        </div>
        <div role="tabpanel" id="panel-cleaner" aria-labelledby="tab-cleaner" hidden={tab !== "cleaner"}>
          <PixelCleaner />
        </div>
        <div role="tabpanel" id="panel-motion" aria-labelledby="tab-motion" hidden={tab !== "motion"}>
          <MotionStabilizer active={tab === "motion"} />
        </div>
      </div>
    </div>
  );
}
