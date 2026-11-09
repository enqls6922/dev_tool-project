"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ACCEPTED_RASTER_ACCEPT, acceptRasterUploads } from "@/lib/uploadSecurity";

type Props = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  title?: string;
  hint?: string;
};

export function DropZone({
  onFiles,
  multiple = true,
  title = "PNG, JPG, WebP를 떨어뜨리거나 클릭해서 선택",
  hint = "여러 장을 한 번에 올릴 수 있습니다. SVG와 그 외 파일은 차단되고, 파일당 15MB, 한 변 4096px까지입니다.",
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const onFilesRef = useRef(onFiles);
  const [active, setActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const takeFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { accepted, message } = acceptRasterUploads(Array.from(list));
    if (message) setToast(message);
    else setToast(null);
    if (accepted.length === 0) return;
    onFilesRef.current(accepted);
  };
  const takeFilesRef = useRef(takeFiles);

  useEffect(() => {
    onFilesRef.current = onFiles;
    takeFilesRef.current = takeFiles;
  });

  // One DOM listener, shared with drag-and-drop. React's delegated onChange is
  // not added as well, so a single selection is not imported twice.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onChange = () => {
      takeFilesRef.current(input.files);
      input.value = "";
    };
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, []);

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActive(false);
    takeFiles(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      {toast ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-[#f07178]/40 bg-[#2a1518] px-3 py-2 text-sm text-[#ffc1c4]"
        >
          <p>{toast}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="알림 닫기"
            className="rounded-md p-1 text-[#ffc1c4] hover:bg-[#3a1c22]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
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
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_RASTER_ACCEPT}
          multiple={multiple}
          className="sr-only"
        />
      </label>
    </div>
  );
}
