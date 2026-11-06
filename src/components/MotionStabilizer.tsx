"use client";

import { Download, GripVertical, LoaderCircle, Pause, Play, SkipBack, SkipForward, Trash2, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { DropZone } from "@/components/DropZone";
import { useMotionStabilizer, type MotionFrame } from "@/hooks/useMotionStabilizer";
import {
  guideRow,
  renderSpriteStrip,
  renderStabilizedCanvas,
  SPRITESHEET_JSON,
  SPRITESHEET_PNG,
} from "@/lib/motionStabilizer";

type Props = {
  active?: boolean;
};

function fitPixelScale(width: number, height: number, target: number, maxScale: number): number {
  const edge = Math.max(width, height, 1);
  if (edge > target) return 1;
  return Math.max(1, Math.min(maxScale, Math.floor(target / edge)));
}

function paintFrame(
  canvas: HTMLCanvasElement | null,
  source: HTMLCanvasElement | null,
  destX: number,
  destY: number,
  width: number,
  height: number,
  ground: number | null,
) {
  if (!canvas || width < 1 || height < 1) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  if (source) context.drawImage(source, destX, destY);
  if (ground !== null) {
    context.fillStyle = "#e39b4b";
    context.fillRect(0, ground, width, 1);
  }
}

export function MotionStabilizer({ active = true }: Props) {
  const motion = useMotionStabilizer(active);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const stableRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const { playable, layout, sheet } = motion;
  const index = playable.length === 0 ? 0 : Math.min(motion.frameIndex, playable.length - 1);
  const current = playable[index] ?? null;

  const stage = useMemo(() => {
    let width = 1;
    let height = 1;
    for (const frame of playable) {
      width = Math.max(width, frame.sourceWidth);
      height = Math.max(height, frame.sourceHeight);
    }
    return { width, height };
  }, [playable]);

  const scale = layout
    ? fitPixelScale(
        Math.max(stage.width, layout.canvasWidth),
        Math.max(stage.height, layout.canvasHeight),
        240,
        8,
      )
    : 1;
  const stripScale = sheet ? fitPixelScale(sheet.width, sheet.height, 720, 4) : 1;

  useLayoutEffect(() => {
    if (!layout || !current) return;
    const contact = current.bounds ? current.bounds.y + current.bounds.height - 1 : null;
    paintFrame(
      originalRef.current,
      current.sourceCanvas,
      0,
      0,
      stage.width,
      stage.height,
      motion.showGround && contact !== null ? guideRow(contact, stage.height) : null,
    );
    const placement = layout.placements[index];
    paintFrame(
      stableRef.current,
      placement?.bounds ? current.sourceCanvas : null,
      placement?.destX ?? 0,
      placement?.destY ?? 0,
      layout.canvasWidth,
      layout.canvasHeight,
      motion.showGround ? guideRow(layout.yOffset, layout.canvasHeight) : null,
    );
  }, [current, index, layout, motion.showGround, stage.height, stage.width]);

  useLayoutEffect(() => {
    const canvas = stripRef.current;
    if (!canvas || !layout || !sheet) return;
    try {
      const rendered = playable.map((frame, frameIndex) => {
        const placement = layout.placements[frameIndex];
        return renderStabilizedCanvas(
          placement?.bounds ? frame.sourceCanvas : null,
          placement?.destX ?? 0,
          placement?.destY ?? 0,
          layout.canvasWidth,
          layout.canvasHeight,
        );
      });
      const strip = renderSpriteStrip(rendered);
      canvas.width = strip.width;
      canvas.height = strip.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.drawImage(strip, 0, 0);
    } catch {
      canvas.width = 0;
      canvas.height = 0;
    }
  }, [layout, playable, sheet]);

  return (
    <div className="flex flex-col gap-4">
      {motion.notice ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#6a5438] bg-[#23190f] px-3 py-2 text-sm text-[#f3d2a8]">
          <p>{motion.notice}</p>
          <button
            type="button"
            onClick={motion.dismissNotice}
            aria-label="알림 닫기"
            className="rounded-md p-1 text-[#f3d2a8] hover:bg-[#3a2a18]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <DropZone
        title="프레임 PNG를 순서대로 떨어뜨리거나 클릭"
        hint="Walk_01처럼 놓은 순서가 재생 순서입니다. 알파 30 이하 고스트는 발 위치에서 빠집니다."
        onFiles={motion.addFiles}
      />

      {motion.busy ? (
        <p role="status" className="inline-flex items-center gap-2 text-xs text-[#c5cbd6]">
          <LoaderCircle className="size-3.5 animate-spin text-[#e39b4b]" aria-hidden />
          {motion.progress || "프레임 읽는 중"}
        </p>
      ) : null}

      {motion.frames.length > 0 ? (
        <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#ece7df]">
              프레임
              <span className="ml-2 font-mono text-xs font-normal text-[#9aa3b5]">{motion.frames.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={motion.sortByName}
                disabled={motion.frames.length < 2}
                className="inline-flex h-8 items-center rounded-lg border border-[#2a3140] px-2.5 text-xs text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df] disabled:opacity-40"
              >
                이름순
              </button>
              <button
                type="button"
                onClick={motion.clearFrames}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2a3140] px-2.5 text-xs text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df]"
              >
                <Trash2 className="size-3.5" aria-hidden />
                모두 제거
              </button>
            </div>
          </div>
          <ol className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {motion.frames.map((frame, frameIndex) => (
              <FrameThumb
                key={frame.id}
                frame={frame}
                index={frameIndex}
                selected={current?.id === frame.id}
                dragging={dragId === frame.id}
                dropTarget={overId === frame.id && dragId !== frame.id}
                canEarlier={frameIndex > 0}
                canLater={frameIndex < motion.frames.length - 1}
                onShow={() => motion.showFrame(frame.id)}
                onRemove={() => motion.removeFrame(frame.id)}
                onMove={(direction) => motion.moveFrame(frame.id, direction)}
                onDragStart={() => setDragId(frame.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={() => setOverId(frame.id)}
                onDrop={(sourceId) => {
                  motion.reorder(sourceId, frame.id);
                  setDragId(null);
                  setOverId(null);
                }}
              />
            ))}
          </ol>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#ece7df]">애니메이션 비교</h2>
            <p className="mt-1 text-xs leading-5 text-[#9aa3b5]">
              알파 31 이상만 발과 중심으로 잡고, 가장 큰 박스보다 사방으로 4px 넓은 캔버스에 맞춥니다. 미리보기는
              최근접(pixelated)입니다.
            </p>
          </div>
          {layout && sheet ? (
            <p className="font-mono text-[11px] text-[#c5cbd6]">
              Canvas {layout.canvasWidth}×{layout.canvasHeight} · {sheet.frameCount} frames · Tile {sheet.tileWidth}×
              {sheet.tileHeight} · Y Offset {layout.yOffset}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => motion.setPlaying((value) => !value)}
              disabled={playable.length === 0}
              aria-pressed={motion.playing}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#6a5438] bg-[#23190f] px-3 text-sm text-[#f3d2a8] transition hover:bg-[#3a2a18] disabled:opacity-40"
            >
              {motion.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {motion.playing ? "일시정지" : "재생"}
            </button>
            <button
              type="button"
              onClick={() => motion.step(-1)}
              disabled={playable.length === 0}
              aria-label="이전 프레임"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-[#2a3140] text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df] disabled:opacity-40"
            >
              <SkipBack className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => motion.step(1)}
              disabled={playable.length === 0}
              aria-label="다음 프레임"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-[#2a3140] text-[#c5cbd6] transition hover:bg-[#222836] hover:text-[#ece7df] disabled:opacity-40"
            >
              <SkipForward className="size-4" aria-hidden />
            </button>
            <p className="min-w-24 font-mono text-xs text-[#ece7df]">
              {playable.length === 0 ? "0 / 0" : `${index + 1} / ${playable.length}`}
              {current ? <span className="mt-0.5 block truncate text-[10px] text-[#9aa3b5]">{current.name}</span> : null}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={motion.showGround}
              onClick={() => motion.setShowGround((value) => !value)}
              className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm transition ${
                motion.showGround
                  ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                  : "border-[#2a3140] text-[#c5cbd6] hover:bg-[#222836]"
              }`}
            >
              바닥 가이드
            </button>
          </div>

          <label className="block min-w-[220px] flex-1" htmlFor="motion-fps">
            <span className="mb-2 flex items-center justify-between text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">
              FPS
              <span className="font-mono text-sm tracking-normal text-[#ece7df] normal-case">{motion.fps} fps</span>
            </span>
            <input
              id="motion-fps"
              type="range"
              min={0}
              max={motion.fpsOptions.length - 1}
              step={1}
              value={Math.max(0, motion.fpsOptions.indexOf(motion.fps))}
              aria-valuemin={motion.fpsOptions[0]}
              aria-valuemax={motion.fpsOptions[motion.fpsOptions.length - 1]}
              aria-valuenow={motion.fps}
              aria-valuetext={`${motion.fps} fps`}
              onChange={(event) => {
                const next = motion.fpsOptions[Number(event.target.value)];
                if (next) motion.setFps(next);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3140] accent-[#e39b4b]"
            />
            <span className="mt-1 flex justify-between font-mono text-[10px] text-[#6f788a]">
              {motion.fpsOptions.map((value) => (
                <span key={value} className={value === motion.fps ? "text-[#f3d2a8]" : undefined}>
                  {value}
                </span>
              ))}
            </span>
          </label>
        </div>

        {motion.sheetError ? (
          <p className="mt-4 rounded-xl border border-[#f07178]/40 bg-[#2a1518] px-3 py-2 text-sm text-[#f3b4b8]">
            {motion.sheetError}
          </p>
        ) : null}

        {layout && current ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ComparePane
              title="Original (보정 전)"
              canvasRef={originalRef}
              width={stage.width}
              height={stage.height}
              scale={scale}
              caption={`${stage.width}×${stage.height}`}
            />
            <ComparePane
              title="Stabilized (보정 후)"
              canvasRef={stableRef}
              width={layout.canvasWidth}
              height={layout.canvasHeight}
              scale={scale}
              caption={`${layout.canvasWidth}×${layout.canvasHeight}`}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-[#2a3140] px-4 py-8 text-center text-sm text-[#9aa3b5]">
            {motion.frames.length === 0
              ? "프레임을 올리면 보정 전과 후가 나란히 루프됩니다."
              : "알파 30을 넘는 픽셀이 있어야 공통 캔버스와 바닥 기준선을 잡습니다."}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#ece7df]">내보내기</h2>
            <p className="mt-1 text-xs leading-5 text-[#9aa3b5]">
              보정 프레임을 가로 1열 스트립으로 패킹합니다. JSON에 프레임 수와 타일 크기가 들어갑니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void motion.downloadPng();
              }}
              disabled={!sheet || motion.downloading !== null}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#e39b4b] px-3 text-sm font-medium text-[#1a1208] transition hover:bg-[#f0b56a] disabled:opacity-40"
            >
              {motion.downloading === "png" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {SPRITESHEET_PNG}
            </button>
            <button
              type="button"
              onClick={motion.downloadJson}
              disabled={!sheet || motion.downloading !== null}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#6a5438] bg-[#23190f] px-3 text-sm font-medium text-[#f3d2a8] transition hover:bg-[#3a2a18] disabled:opacity-40"
            >
              {motion.downloading === "json" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {SPRITESHEET_JSON}
            </button>
          </div>
        </div>
        {sheet ? (
          <div className="checkerboard mt-4 max-w-full overflow-auto rounded-xl border border-[#2a3140] p-3">
            <canvas
              ref={stripRef}
              role="img"
              aria-label={`보정된 가로 스트립 ${sheet.width}×${sheet.height}`}
              className="block"
              style={{
                width: sheet.width * stripScale,
                height: sheet.height * stripScale,
                imageRendering: "pixelated",
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ComparePane({
  title,
  canvasRef,
  width,
  height,
  scale,
  caption,
}: {
  title: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  scale: number;
  caption: string;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[#ece7df]">{title}</span>
        <span className="font-mono text-[10px] text-[#6f788a]">{caption}</span>
      </figcaption>
      <div className="checkerboard max-h-[360px] overflow-auto rounded-xl border border-[#2a3140] p-3">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={title}
          width={width}
          height={height}
          className="block"
          style={{
            width: width * scale,
            height: height * scale,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </figure>
  );
}

function FrameThumb({
  frame,
  index,
  selected,
  dragging,
  dropTarget,
  canEarlier,
  canLater,
  onShow,
  onRemove,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  frame: MotionFrame;
  index: number;
  selected: boolean;
  dragging: boolean;
  dropTarget: boolean;
  canEarlier: boolean;
  canLater: boolean;
  onShow: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (sourceId: string) => void;
}) {
  return (
    <li
      className={`w-24 shrink-0 rounded-xl border p-1.5 ${
        dropTarget
          ? "border-[#e39b4b] bg-[#e39b4b]/10"
          : selected
            ? "border-[#e39b4b]/70 bg-[#23190f]"
            : "border-[#2a3140] bg-[#0d1016]"
      } ${dragging ? "opacity-50" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
    >
      <div
        className={`checkerboard relative aspect-square overflow-hidden rounded-lg border ${
          frame.status === "error" ? "border-[#f07178]" : frame.status === "empty" ? "border-[#6a5438]" : "border-transparent"
        }`}
      >
        <button type="button" onClick={onShow} className="block h-full w-full" aria-label={`${frame.name} 프레임 보기`}>
          {frame.previewUrl ? (
            // Local blob preview. next/image cannot take an object URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frame.previewUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[10px] text-[#f07178] uppercase">error</span>
          )}
        </button>
        <span className="pointer-events-none absolute top-1 left-1 rounded bg-[#0d1016]/85 px-1 font-mono text-[10px] text-[#f3d2a8]">
          {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${frame.name} 제거`}
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded bg-[#0d1016]/85 text-[#ece7df] hover:bg-[#f07178] hover:text-[#1a0c0e]"
        >
          <X className="size-3" aria-hidden />
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <button
          type="button"
          draggable
          aria-label={`${frame.name} 순서 바꾸기`}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", frame.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className="inline-flex size-6 cursor-grab items-center justify-center rounded text-[#9aa3b5] hover:bg-[#222836] hover:text-[#ece7df] active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!canEarlier}
          aria-label={`${frame.name} 앞으로`}
          className="inline-flex size-6 items-center justify-center rounded text-[#9aa3b5] hover:bg-[#222836] hover:text-[#ece7df] disabled:opacity-30"
        >
          <SkipBack className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!canLater}
          aria-label={`${frame.name} 뒤로`}
          className="inline-flex size-6 items-center justify-center rounded text-[#9aa3b5] hover:bg-[#222836] hover:text-[#ece7df] disabled:opacity-30"
        >
          <SkipForward className="size-3" aria-hidden />
        </button>
      </div>
      <p className="truncate text-[11px] text-[#ece7df]" title={frame.fileName}>
        {frame.name}
      </p>
      {frame.message ? <p className="truncate text-[10px] text-[#d7b15a]">{frame.message}</p> : null}
    </li>
  );
}
