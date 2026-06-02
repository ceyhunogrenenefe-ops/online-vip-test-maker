"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PixelCrop } from "@/lib/crop";
import type { DetectedQuestion } from "@/lib/question-detect";
import { ResizableCropBox, CropBoxOutline } from "./ResizableCropBox";

interface Props {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  onImageSize: (w: number, h: number) => void;
  /** Aktif düzenlenebilir kutu */
  activeCrop: PixelCrop | null;
  onActiveCropChange: (crop: PixelCrop) => void;
  /** Otomatik modda diğer kutular */
  detected?: DetectedQuestion[];
  selectedDetectId?: string | null;
  onSelectDetect?: (id: string) => void;
}

export function ImageCropCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  onImageSize,
  activeCrop,
  onActiveCropChange,
  detected = [],
  selectedDetectId,
  onSelectDetect,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setDisplaySize({
      width: img.clientWidth,
      height: img.clientHeight,
    });
  }, []);

  useEffect(() => {
    measure();
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, imageSrc]);

  const showOutlines =
    detected.length > 0 && selectedDetectId !== undefined;

  return (
    <div className="flex h-full w-full justify-center overflow-auto bg-slate-800 p-2">
      <div className="relative inline-block max-w-full select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Kırpılacak sayfa"
          className="block max-w-full h-auto"
          draggable={false}
          onLoad={(e) => {
            const t = e.currentTarget;
            onImageSize(t.naturalWidth, t.naturalHeight);
            measure();
          }}
        />

        {displaySize.width > 0 &&
          showOutlines &&
          detected.map((region) => (
            <CropBoxOutline
              key={region.id}
              crop={region.crop}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              displayWidth={displaySize.width}
              displayHeight={displaySize.height}
              selected={region.id === selectedDetectId}
              onSelect={() => onSelectDetect?.(region.id)}
            />
          ))}

        {displaySize.width > 0 && activeCrop && imageWidth > 0 && (
          <ResizableCropBox
            crop={activeCrop}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            displayWidth={displaySize.width}
            displayHeight={displaySize.height}
            onChange={onActiveCropChange}
            accent="amber"
            zIndex={15}
          />
        )}
      </div>
    </div>
  );
}
