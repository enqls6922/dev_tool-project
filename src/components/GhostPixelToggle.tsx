"use client";

import { useId } from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  detail?: string | null;
  className?: string;
};

export function GhostPixelToggle({ checked, onChange, detail, className = "mt-4" }: Props) {
  const inputId = useId();

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#2a3140] bg-[#0d1016] px-3 py-3"
      >
        <span>
          <span className="block text-sm font-medium text-[#ece7df]">AI 고스트 픽셀 제거 (Alpha &lt; 30 청소)</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#9aa3b5]">
            알파가 1 이상 30 이하인 반투명 점 노이즈를 완전 투명으로 바꿉니다.
          </span>
        </span>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 shrink-0 accent-[#e39b4b]"
        />
      </label>
      {detail ? <p className="mt-2 text-xs leading-5 text-[#9aa3b5]">{detail}</p> : null}
    </div>
  );
}
