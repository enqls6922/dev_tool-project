"use client";

import { X } from "lucide-react";
import { AtlasPreview } from "@/components/AtlasPreview";
import { ControlPanel } from "@/components/ControlPanel";
import { DropZone } from "@/components/DropZone";
import { SpriteGrid } from "@/components/SpriteGrid";
import { useSpriteForge } from "@/hooks/useSpriteForge";

export function SpritePackerPanel() {
  const forge = useSpriteForge();

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
  );
}
