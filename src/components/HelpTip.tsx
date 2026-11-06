"use client";

import { CircleQuestionMark } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type Props = {
  label: string;
  text: string;
};

type Bubble = {
  top: number;
  left: number;
  width: number;
  arrow: number;
};

export function HelpTip({ label, text }: Props) {
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef("");
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(264, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const arrow = Math.min(width - 16, Math.max(10, rect.left + rect.width / 2 - left - 4));
      setBubble({ top: rect.bottom + 8, left, width, arrow });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || pointerRef.current === "mouse") return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex normal-case"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tooltipId}
        onPointerDown={(event) => {
          pointerRef.current = event.pointerType;
        }}
        onClick={() => {
          if (pointerRef.current === "mouse") return;
          setOpen((value) => !value);
        }}
        onFocus={() => {
          if (pointerRef.current === "" || pointerRef.current === "mouse") setOpen(true);
        }}
        onBlur={() => {
          if (pointerRef.current !== "touch") setOpen(false);
        }}
        className="inline-flex size-4 items-center justify-center rounded-full text-[#8b93a7] transition hover:text-[#f3d2a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e39b4b]"
      >
        <CircleQuestionMark className="size-3.5" aria-hidden />
      </button>
      {open && bubble ? (
        <span
          id={tooltipId}
          role="tooltip"
          style={{ top: bubble.top, left: bubble.left, width: bubble.width }}
          className="fixed z-50 rounded-xl border border-[#3d4658] bg-[#1c2330] px-3 py-2 text-left text-[11px] leading-5 font-normal tracking-normal text-[#ece7df] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <span
            aria-hidden
            style={{ left: bubble.arrow }}
            className="absolute -top-1 size-2 rotate-45 border-t border-l border-[#3d4658] bg-[#1c2330]"
          />
          {text}
        </span>
      ) : null}
    </span>
  );
}
