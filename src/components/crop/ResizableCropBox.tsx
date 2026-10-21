"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PixelCrop } from "@/lib/crop";
import {
  applyResize,
  clampCrop,
  type ResizeHandle,
} from "@/lib/crop-math";

interface Props {
  crop: PixelCrop;
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  onChange: (crop: PixelCrop) => void;
  accent?: "amber" | "green" | "blue";
  zIndex?: number;
}

const HANDLES: { id: ResizeHandle; className: string; cursor: string }[] = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { id: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { id: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

const accentStyles = {
  amber: "border-2 border-dashed border-white bg-black/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
  green: "border-2 border-green-500 bg-green-400/10",
  blue: "border-2 border-dashed border-white bg-black/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
};

const handleClass =
  "absolute z-10 h-6 w-6 touch-none border border-slate-500 bg-slate-300 shadow-sm";

export function ResizableCropBox({
  crop,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  onChange,
  accent = "amber",
  zIndex = 10,
}: Props) {
  const dragRef = useRef<{
    handle: ResizeHandle;
    startCrop: PixelCrop;
    startX: number;
    startY: number;
  } | null>(null);

  const scaleX = displayWidth > 0 ? displayWidth / imageWidth : 1;
  const scaleY = displayHeight > 0 ? displayHeight / imageHeight : 1;

  const left = crop.x * scaleX;
  const top = crop.y * scaleY;
  const width = crop.width * scaleX;
  const height = crop.height * scaleY;

  const onPointerDown = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        handle,
        startCrop: { ...crop },
        startX: e.clientX,
        startY: e.clientY,
      };
    },
    [crop]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { handle, startCrop, startX, startY } = dragRef.current;
      const dx = (e.clientX - startX) / scaleX;
      const dy = (e.clientY - startY) / scaleY;
      onChange(
        applyResize(
          startCrop,
          handle,
          dx,
          dy,
          imageWidth,
          imageHeight
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [imageWidth, imageHeight, onChange, scaleX, scaleY]);

  return (
    <div
      className={`absolute touch-none ${accentStyles[accent]}`}
      style={{ left, top, width, height, zIndex }}
    >
      <div
        role="button"
        tabIndex={0}
        className="absolute inset-0 cursor-move"
        onPointerDown={(e) => onPointerDown("move", e)}
        aria-label="Kırpma alanını taşı"
      />
      {HANDLES.map(({ id, className, cursor }) => (
        <div
          key={id}
          role="button"
          tabIndex={0}
          className={`${handleClass} ${className}`}
          style={{ cursor }}
          onPointerDown={(e) => onPointerDown(id, e)}
          aria-label={`Boyut: ${id}`}
        />
      ))}
    </div>
  );
}

/** Sadece gösterim — tıklanınca seçilir */
export function CropBoxOutline({
  crop,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  selected,
  onSelect,
}: {
  crop: PixelCrop;
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const scaleX = displayWidth > 0 ? displayWidth / imageWidth : 1;
  const scaleY = displayHeight > 0 ? displayHeight / imageHeight : 1;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute border-2 transition ${
        selected
          ? "border-transparent"
          : "border-green-400/80 bg-green-400/10 hover:bg-green-400/20"
      }`}
      style={{
        left: crop.x * scaleX,
        top: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY,
        zIndex: selected ? 5 : 4,
      }}
    />
  );
}

export function syncCropToDetected<T extends { id: string; crop: PixelCrop }>(
  detected: T[],
  id: string,
  crop: PixelCrop
): T[] {
  return detected.map((d) => (d.id === id ? { ...d, crop } : d));
}

