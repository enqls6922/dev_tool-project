"use client";

import { ImagePlus } from "lucide-react";
import { useId, useState, type DragEvent } from "react";

type Props = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  title?: string;
  hint?: string;
};

export function DropZone({
  onFiles,
  multiple = true,
  title = "PNG를 떨어뜨리거나 클릭해서 선택",
  hint = "여러 장을 한 번에 올릴 수 있습니다. 디코딩, 트림, 패킹은 이 브라우저 캔버스에서만 돌아갑니다.",
}: Props) {
  const inputId = useId();
  const [active, setActive] = useState(false);

  const takeFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActive(false);
    takeFiles(event.dataTransfer.files);
  };

  return (
    <label
      htmlFor={inputId}
      onDragEnter={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setActive(false);
      }}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition ${
        active
          ? "border-[#e39b4b] bg-[#e39b4b]/10"
          : "border-[#3a4252] bg-[#10141b] hover:border-[#6a5438] hover:bg-[#161b24]"
      }`}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-xl border border-[#2a3140] bg-[#0d1016] text-[#e39b4b]">
        <ImagePlus className="size-5" aria-hidden />
      </span>
      <span className="text-sm font-medium text-[#ece7df]">{title}</span>
      <span className="mt-1 max-w-sm text-xs leading-5 text-[#9aa3b5]">{hint}</span>
      <input
        id={inputId}
        type="file"
        accept="image/png,.png"
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}
