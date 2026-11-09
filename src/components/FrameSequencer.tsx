"use client";

import { Download, Eye, EyeOff, LoaderCircle, Pause, Play, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { DropZone } from "@/components/DropZone";
import { useFrameSequencer, type SequenceFrame } from "@/hooks/useFrameSequencer";
import { SEQUENCE_FPS, type SequenceFps } from "@/lib/frameSequencer";

type Props = {
  active: boolean;
};

export function FrameSequencer({ active }: Props) {
  const sequencer = useFrameSequencer();

  return (
    <div className="flex flex-col gap-6">
      {sequencer.notice ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#6a5438] bg-[#23190f] px-3 py-2 text-sm text-[#f3d2a8]">
          <p>{sequencer.notice}</p>
          <button
            type="button"
            onClick={sequencer.dismissNotice}
            aria-label="알림 닫기"
            className="rounded-md p-1 text-[#f3d2a8] hover:bg-[#3a2a18]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <h2 className="text-sm font-semibold text-[#ece7df]">재생</h2>
            <label className="mt-4 block" htmlFor="sequence-fps">
              <span className="mb-2 flex items-center justify-between text-xs font-medium tracking-wide text-[#9aa3b5] uppercase">
                FPS
                <span className="font-mono text-sm tracking-normal text-[#ece7df] normal-case">{sequencer.fps}</span>
              </span>
              <input
                id="sequence-fps"
                type="range"
                min={0}
                max={SEQUENCE_FPS.length - 1}
                step={1}
                value={SEQUENCE_FPS.indexOf(sequencer.fps)}
                aria-valuemin={0}
                aria-valuemax={SEQUENCE_FPS.length - 1}
                aria-valuenow={SEQUENCE_FPS.indexOf(sequencer.fps)}
                aria-valuetext={`${sequencer.fps} FPS`}
                onChange={(event) => {
                  const next = SEQUENCE_FPS[Number(event.target.value)];
                  if (next) sequencer.setFps(next satisfies SequenceFps);
                }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3140] accent-[#e39b4b]"
              />
              <span className="mt-1 flex justify-between font-mono text-[10px] text-[#6f788a]">
                {SEQUENCE_FPS.map((rate) => (
                  <span key={rate}>{rate}</span>
                ))}
              </span>
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => sequencer.setPlaying(!sequencer.playing)}
                aria-pressed={sequencer.playing}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#2a3140] bg-[#0d1016] px-3 text-sm text-[#ece7df] transition hover:border-[#465066]"
              >
                {sequencer.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {sequencer.playing ? "일시정지" : "재생"}
              </button>
              <button
                type="button"
                onClick={() => sequencer.setShowGround(!sequencer.showGround)}
                aria-pressed={sequencer.showGround}
                className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition ${
                  sequencer.showGround
                    ? "border-[#e39b4b] bg-[#e39b4b]/15 text-[#f3d2a8]"
                    : "border-[#2a3140] bg-[#0d1016] text-[#c5cbd6] hover:border-[#465066]"
                }`}
              >
                {sequencer.showGround ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                바닥 가이드 라인
              </button>
            </div>
          </section>

          <DropZone
            title="프레임 이미지를 떨어뜨리거나 클릭"
            hint="PNG, JPG, WebP. 올린 순서가 재생 순서이고, 썸네일을 좌우로 끌어 바꿀 수 있습니다. SVG는 올리지 않습니다."
            onFiles={(files) => {
              void sequencer.addFiles(files);
            }}
          />

          <button
            type="button"
            disabled={sequencer.frames.length === 0 || sequencer.downloading}
            onClick={() => {
              void sequencer.download();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e39b4b] px-4 text-sm font-semibold text-[#1a1208] transition hover:bg-[#f0b56a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sequencer.downloading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            ZIP 내보내기
          </button>
          {sequencer.error ? <p className="text-sm text-[#f0a0a0]">{sequencer.error}</p> : null}
          <p className="text-xs leading-5 text-[#6f788a]">
            Spritesheet.png, FrameData.json, Editor/AnimationClipBuilder.cs. 유니티에서 시트를 선택하고 Tools/SpriteForge/Build Animation Clip을 실행하면 Assets/Animations에 루프 클립이 생깁니다.
          </p>
        </div>

        <Preview
          active={active}
          frames={sequencer.frames}
          fps={sequencer.fps}
          playing={sequencer.playing}
          showGround={sequencer.showGround}
        />
      </div>

      <FrameStrip
        frames={sequencer.frames}
        busy={sequencer.busy}
        onMove={sequencer.moveFrame}
        onRemove={sequencer.removeFrame}
        onClear={sequencer.clearFrames}
      />
    </div>
  );
}

function Preview({
  active,
  frames,
  fps,
  playing,
  showGround,
}: {
  active: boolean;
  frames: SequenceFrame[];
  fps: number;
  playing: boolean;
  showGround: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef(0);
  const labelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (indexRef.current >= frames.length) indexRef.current = 0;
  }, [frames.length]);

  useEffect(() => {
    if (!active || frames.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const list = frames;
    const step = 1000 / fps;

    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const index = indexRef.current % list.length;
      const frame = list[index];
      if (!frame) return;
      const cellWidth = list.reduce((max, item) => Math.max(max, item.width), 1);
      const cellHeight = list.reduce((max, item) => Math.max(max, item.height), 1);
      const fit = Math.min(360 / cellWidth, 280 / cellHeight);
      const scale = fit >= 1 ? Math.min(8, Math.floor(fit)) : fit;
      const viewW = Math.max(1, Math.round(cellWidth * scale));
      const viewH = Math.max(1, Math.round(cellHeight * scale));
      if (canvas.width !== viewW || canvas.height !== viewH) {
        canvas.width = viewW;
        canvas.height = viewH;
      }
      context.imageSmoothingEnabled = scale >= 1 ? false : true;
      context.clearRect(0, 0, viewW, viewH);
      const dx = Math.floor((cellWidth - frame.width) / 2) * scale;
      const dy = (cellHeight - frame.height) * scale;
      context.drawImage(frame.canvas, dx, dy, frame.width * scale, frame.height * scale);
      if (showGround) {
        context.fillStyle = "#e39b4b";
        context.fillRect(0, Math.max(0, viewH - 2), viewW, 2);
      }
      if (labelRef.current) {
        labelRef.current.textContent = `${index + 1} / ${list.length} · ${fps} FPS`;
      }
    };

    const loop = (now: number) => {
      if (playing && list.length > 1) {
        acc += now - last;
        while (acc >= step) {
          acc -= step;
          indexRef.current = (indexRef.current + 1) % list.length;
        }
      }
      last = now;
      paint();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, frames, fps, playing, showGround]);

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#ece7df]">프리뷰</h2>
        <p ref={labelRef} className="font-mono text-xs text-[#9aa3b5]">
          프레임 없음
        </p>
      </div>
      <div className="checkerboard flex min-h-56 items-center justify-center overflow-auto rounded-xl border border-[#2a3140] p-4">
        {frames.length === 0 ? (
          <p className="text-sm text-[#9aa3b5]">프레임을 올리면 여기서 재생됩니다.</p>
        ) : (
          <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: "pixelated" }} />
        )}
      </div>
    </section>
  );
}

function FrameStrip({
  frames,
  busy,
  onMove,
  onRemove,
  onClear,
}: {
  frames: SequenceFrame[];
  busy: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const dragRef = useRef<{ pointerId: number; index: number; originX: number } | null>(null);

  return (
    <section className="rounded-2xl border border-[#2a3140] bg-[#13171f]/95 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#ece7df]">프레임 순서</h2>
        <div className="flex items-center gap-2">
          {busy ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#c5cbd6]">
              <LoaderCircle className="size-3.5 animate-spin text-[#e39b4b]" aria-hidden />
              읽는 중
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            disabled={frames.length === 0}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2a3140] px-2 text-xs text-[#c5cbd6] transition hover:text-[#ece7df] disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
            모두 제거
          </button>
        </div>
      </div>
      {frames.length === 0 ? (
        <p className="text-xs text-[#6f788a]">썸네일이 여기에 가로로 쌓입니다.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="프레임 순서">
          {frames.map((frame, index) => (
            <div key={frame.id} role="listitem" className="w-[76px] shrink-0">
              <button
                type="button"
                aria-label={`${index + 1}번 ${frame.label} 드래그해서 순서 변경`}
                className="checkerboard flex h-[76px] w-full cursor-grab items-end justify-center overflow-hidden rounded-lg border border-[#2a3140] active:cursor-grabbing"
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragRef.current = { pointerId: event.pointerId, index, originX: event.clientX };
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  const step = Math.trunc((event.clientX - drag.originX) / 76);
                  if (step === 0) return;
                  const next = Math.min(frames.length - 1, Math.max(0, drag.index + step));
                  if (next === drag.index) return;
                  onMove(drag.index, next);
                  drag.index = next;
                  drag.originX += step * 76;
                }}
                onPointerUp={(event) => {
                  if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
                }}
              >
                {/* Thumbnail is a local data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.thumbUrl}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </button>
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] text-[#9aa3b5]">{index + 1}</span>
                <button
                  type="button"
                  aria-label={`${frame.label} 제거`}
                  onClick={() => onRemove(frame.id)}
                  className="text-[#6f788a] hover:text-[#ece7df]"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
