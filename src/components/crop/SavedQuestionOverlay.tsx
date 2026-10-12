"use client";

import { Check } from "lucide-react";
import type { PixelCrop } from "@/lib/crop";

interface Props {
  index: number;
  crop: PixelCrop;
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  onDelete: () => void;
}

export function SavedQuestionOverlay({
  index,
  crop,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  onDelete,
}: Props) {
  const scaleX = displayWidth > 0 ? displayWidth / imageWidth : 1;
  const scaleY = displayHeight > 0 ? displayHeight / imageHeight : 1;

  const left = crop.x * scaleX;
  const top = crop.y * scaleY;
  const width = crop.width * scaleX;
  const height = crop.height * scaleY;

  return (
    <div
      className="absolute border-2 border-green-500 bg-white/5"
      style={{ left, top, width, height, zIndex: 8 }}
    >
      <div className="absolute left-0 top-0 flex max-w-full items-start justify-between gap-1 p-1">
        <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
          {index}. Soru
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded bg-dershanem-blue px-2 py-0.5 text-[11px] font-medium text-white shadow hover:bg-blue-700"
        >
          Soruyu Sil
        </button>
      </div>
      <div className="absolute bottom-1 right-1">
        <span className="inline-flex items-center gap-0.5 rounded bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white shadow">
          <Check size={12} />
          Yüklendi
        </span>
      </div>
    </div>
  );
}
