"use client";

import { Eraser, Paintbrush, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  SANDBOX_CELL_PX,
  SANDBOX_SIZE,
  emptySandbox,
  paintCell,
  sandboxPillarOverlayRect,
  sandboxSourceRect,
  type SandboxLayout,
} from "@/lib/tileSandbox";

type Tool = "brush" | "eraser";

type Props = {
  previewUrl: string | null;
  tileSize: number;
  canSample: boolean;
  layout: SandboxLayout;
};

const MASK_COLORS = [
  "#5c6b82",
  "#d4654a",
  "#e39b4b",
  "#f0c36a",
  "#7dbe6a",
  "#3faf8a",
  "#4aa3c7",
  "#6d7fd6",
  "#a56bd4",
  "#d46b9a",
  "#c45b4a",
  "#8a9a4a",
  "#4a8a7a",
  "#4a6a9a",
  "#9a6a4a",
  "#ece7df",
];

export function TileSandbox({ previewUrl, tileSize, canSample, layout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [cells, setCells] = useState<number[]>(() => emptySandbox());
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [loadedSheet, setLoadedSheet] = useState<{ url: string; image: HTMLImageElement } | null>(null);
  const paintingRef = useRef(false);
  const sheet = loadedSheet && loadedSheet.url === previewUrl && canSample ? loadedSheet.image : null;

  useEffect(() => {
    if (!previewUrl || !canSample) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setLoadedSheet({ url: previewUrl, image });
    };
    image.onerror = () => {
      if (!cancelled) setLoadedSheet(null);
    };
    image.src = previewUrl;
    return () => {
      cancelled = true;
    };
  }, [previewUrl, canSample]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const grid = cells;
    const image = sheet;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < SANDBOX_SIZE; y += 1) {
      for (let x = 0; x < SANDBOX_SIZE; x += 1) {
        const dx = x * SANDBOX_CELL_PX;
        const dy = y * SANDBOX_CELL_PX;
        context.fillStyle = (x + y) % 2 === 0 ? "#141820" : "#1b2230";
        context.fillRect(dx, dy, SANDBOX_CELL_PX, SANDBOX_CELL_PX);
        const overlay = sandboxPillarOverlayRect(grid, x, y, tileSize, SANDBOX_SIZE, layout);
        const sample = sandboxSourceRect(grid, x, y, tileSize, SANDBOX_SIZE, layout);
        const drawn = sample ?? overlay;
        if (drawn) {
          if (image && image.complete && image.naturalWidth > 0) {
            context.drawImage(
              image,
              drawn.x,
              drawn.y,
              drawn.width,
              drawn.height,
              dx,
              dy,
              SANDBOX_CELL_PX,
              SANDBOX_CELL_PX,
            );
          } else {
            const swatch = sample ? sample.mask & 15 : drawn.index & 15;
            context.fillStyle = MASK_COLORS[swatch] ?? "#ece7df";
            context.fillRect(dx + 1, dy + 1, SANDBOX_CELL_PX - 2, SANDBOX_CELL_PX - 2);
            context.fillStyle = "#101318";
            context.font = "11px ui-monospace, monospace";
            context.fillText(String(drawn.index), dx + 4, dy + 14);
          }
        }
        context.strokeStyle = "rgba(255,255,255,0.14)";
        context.strokeRect(dx + 0.5, dy + 0.5, SANDBOX_CELL_PX - 1, SANDBOX_CELL_PX - 1);
      }
    }
  }, [cells, sheet, tileSize, layout]);

  function cellFromEvent(event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * SANDBOX_SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * SANDBOX_SIZE);
    return {
      x: Math.min(SANDBOX_SIZE - 1, Math.max(0, x)),
      y: Math.min(SANDBOX_SIZE - 1, Math.max(0, y)),
    };
  }

  function valueFor(event: { button: number; buttons: number }): 0 | 1 | null {
    if ((event.buttons & 2) === 2 || event.button === 2) return 0;
    if ((event.buttons & 1) !== 1 && event.button !== 0) return null;
    return tool === "eraser" ? 0 : 1;
  }

  function apply(x: number, y: number, value: 0 | 1) {
    setCells((current) => paintCell(current, x, y, value));
  }

  const hoverSample = hover
    ? sandboxSourceRect(cells, hover.x, hover.y, tileSize, SANDBOX_SIZE, layout)
    : null;
  const hoverOverlay = hover && hoverSample === null
    ? sandboxPillarOverlayRect(cells, hover.x, hover.y, tileSize, SANDBOX_SIZE, layout)
    : null;

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#ece7df]">실시간 붓칠 샌드박스</h2>
          <p className="mt-1 text-xs leading-5 text-[#9aa3b5]">
            {sandboxCaption(layout)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="샌드박스 도구">
          <button
            type="button"
            aria-pressed={tool === "brush"}
            onClick={() => setTool("brush")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
              tool === "brush"
                ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
            }`}
          >
            <Paintbrush className="size-3.5" aria-hidden />
            브러시
          </button>
          <button
            type="button"
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
              tool === "eraser"
                ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
            }`}
          >
            <Eraser className="size-3.5" aria-hidden />
            지우개
          </button>
          <button
            type="button"
            onClick={() => setCells(emptySandbox())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2a3140] bg-[#0d1016] px-3 text-xs font-medium text-[#c5cbd6] transition hover:border-[#465066] hover:text-[#ece7df]"
          >
            <Trash2 className="size-3.5" aria-hidden />
            전체 지우기
          </button>
        </div>
      </div>

      <div className="checkerboard inline-block max-w-full overflow-auto rounded-xl border border-[#2a3140]">
        <canvas
          ref={canvasRef}
          width={SANDBOX_SIZE * SANDBOX_CELL_PX}
          height={SANDBOX_SIZE * SANDBOX_CELL_PX}
          role="application"
          aria-label="8 by 8 PixelLab 타일 샌드박스"
          className="block max-w-full touch-none"
          style={{ width: SANDBOX_SIZE * SANDBOX_CELL_PX, height: SANDBOX_SIZE * SANDBOX_CELL_PX, imageRendering: "pixelated" }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (event.button !== 0 && event.button !== 2) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            paintingRef.current = true;
            const cell = cellFromEvent(event);
            setHover(cell);
            const value = valueFor(event);
            if (value !== null) apply(cell.x, cell.y, value);
          }}
          onPointerMove={(event) => {
            const cell = cellFromEvent(event);
            setHover(cell);
            if (!paintingRef.current) return;
            const value = valueFor(event);
            if (value !== null) apply(cell.x, cell.y, value);
          }}
          onPointerUp={(event) => {
            paintingRef.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerLeave={() => {
            if (!paintingRef.current) setHover(null);
          }}
        />
      </div>

      <p className="mt-2 font-mono text-[11px] text-[#9aa3b5]" role="status">
        {hover
          ? `(${hover.x}, ${hover.y}) · ${
            hoverSample
              ? `마스크 ${hoverSample.mask} · 타일 ${hoverSample.index}`
              : hoverOverlay
                ? `기둥 오버레이 · 타일 ${hoverOverlay.index}`
                : "비어 있음"
          }`
          : canSample
            ? layout.kind === "wang"
              ? layout.tall
                ? layout.fillMode === "wall"
                  ? "Wang 5×8 벽 모드입니다. 내부는 tile_26, 1칸 기둥은 tile_06, 테두리는 바닥 모드의 반대 스프라이트입니다."
                  : "Wang 5×8 바닥 모드입니다. 내부는 tile_16, 외곽은 tile_10·11·12·15·17·20·21·22, 북쪽 테두리 위 빈칸은 tile_05·06·07입니다."
                : "Wang 5×4는 인덱스 = 코너 마스크입니다. 내부 바닥은 tile_15입니다."
              : layout.kind === "godot"
                ? layout.tall
                  ? layout.fillMode === "wall"
                    ? "Godot 12×8 벽 모드입니다. 내부는 tile_41, 세로 기둥은 tile_15·27·63, 남쪽 테두리 아래 빈칸에 기둥을 그립니다."
                    : "Godot 12×8 바닥 모드입니다. 북쪽은 tile_01·02·03, 바로 아래는 tile_61·62·63, 그 아래는 tile_34입니다. 남쪽 기둥은 tile_61·62·63이고 바로 위는 tile_01·02·03입니다. 서쪽은 tile_36, 동쪽은 tile_47입니다."
                  : "PixelLab Godot (47-Blob) 12×4 칸을 8방향 이웃과 같은 픽셀 좌표로 그립니다."
                : layout.shape === "4x8"
                  ? "PixelLab 15-tileset (4×8)입니다. 내부는 tile_14, 맨 윗줄은 tile_12·13·19, 서쪽은 tile_04, 동쪽은 tile_23, 남쪽은 tile_17, 남서는 tile_16, 남동은 tile_27입니다. 맨 윗줄 위 빈칸에는 tile_06·07·03 기둥 몸통이 올라갑니다."
                  : layout.shape === "4x4"
                    ? "PixelLab 15-tileset (4×4)은 네이티브 16마스크입니다. 빈 칸은 tile_12, 내부 바닥은 tile_06입니다."
                    : "PixelLab 15-tileset (3×5 시트)입니다. 내부는 tile_07, 외곽은 tile_00·01·04·06·08·09·10·11입니다."
            : "시트가 선택한 프리셋과 맞으면 타일 이미지를 그립니다. 그 전에는 마스크 숫자로 보여 줍니다."}
      </p>
    </section>
  );
}

function sandboxCaption(layout: SandboxLayout): string {
  const base = "8×8 칸, 각 32px. 좌클릭은 채우고 우클릭은 지웁니다.";
  if (layout.kind === "wang" && layout.tall) {
    return layout.fillMode === "wall"
      ? `${base} 벽 모드는 안쪽을 tile_26으로 채우고, 1칸 기둥은 tile_06입니다.`
      : `${base} 바닥 모드는 안쪽을 tile_16으로 채우고, 북쪽 테두리 위 빈칸에 기둥을 그립니다.`;
  }
  if (layout.kind === "godot" && layout.tall) {
    return layout.fillMode === "wall"
      ? `${base} 벽 모드는 안쪽을 tile_41로 채우고, 남쪽 테두리 아래 빈칸에 기둥을 그립니다.`
      : `${base} 바닥 모드는 안쪽을 tile_34로 채우고, 북쪽 테두리 위 빈칸에 기둥을 그립니다.`;
  }
  if (layout.kind === "fifteen" && layout.shape === "4x8") {
    return `${base} 4×8 바닥은 안쪽을 tile_14로 채웁니다. 검은 기둥 오버레이는 그리지 않습니다.`;
  }
  return `${base} 선택한 프리셋의 8방향 룰로 칸을 고릅니다.`;
}
