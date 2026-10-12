"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PixelCrop } from "@/lib/crop";
import type { AnswerOption, Question } from "@/types";
import type { DetectedQuestion } from "@/lib/question-detect";
import { ResizableCropBox, CropBoxOutline } from "./ResizableCropBox";
import { SavedQuestionOverlay } from "./SavedQuestionOverlay";
import { CropSelectionToolbar } from "./CropSelectionToolbar";

interface SavedOnPage {
  question: Question;
  index: number;
}

interface Props {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  onImageSize: (w: number, h: number) => void;
  activeCrop: PixelCrop | null;
  onActiveCropChange: (crop: PixelCrop) => void;
  detected?: DetectedQuestion[];
  selectedDetectId?: string | null;
  onSelectDetect?: (id: string) => void;
  savedOnPage?: SavedOnPage[];
  onDeleteSaved?: (id: string) => void;
  pendingAnswerKey: AnswerOption | null;
  onAnswerKeyChange: (v: AnswerOption) => void;
  onConfirmCrop: () => void;
  saving: boolean;
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
  savedOnPage = [],
  onDeleteSaved,
  pendingAnswerKey,
  onAnswerKeyChange,
  onConfirmCrop,
  saving,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!activeCrop || displaySize.height <= 0 || imageHeight <= 0) return;
    const scaleY = displaySize.height / imageHeight;
    const boxTop = activeCrop.y * scaleY;
    const boxBottom = (activeCrop.y + activeCrop.height) * scaleY;
    const el = scrollRef.current;
    if (!el) return;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (boxTop < viewTop + 48 || boxBottom > viewBottom - 100) {
      el.scrollTo({ top: Math.max(0, boxTop - 72), behavior: "smooth" });
    }
  }, [activeCrop, displaySize.height, imageHeight]);

  const showOutlines =
    detected.length > 0 && selectedDetectId !== undefined;

  const scaleX = displaySize.width > 0 ? displaySize.width / imageWidth : 1;
  const scaleY = displaySize.height > 0 ? displaySize.height / imageHeight : 1;

  const toolbarPos =
    activeCrop && displaySize.width > 0
      ? {
          left: activeCrop.x * scaleX,
          top: (activeCrop.y + activeCrop.height) * scaleY + 6,
          width: activeCrop.width * scaleX,
        }
      : null;

  return (
    <div
      ref={scrollRef}
      className="flex h-full w-full justify-center overflow-auto bg-slate-100 p-3"
    >
      <div className="relative inline-block max-w-full select-none shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Kırpılacak sayfa"
          className="block max-w-full h-auto bg-white"
          draggable={false}
          onLoad={(e) => {
            const t = e.currentTarget;
            onImageSize(t.naturalWidth, t.naturalHeight);
            measure();
          }}
        />

        {displaySize.width > 0 &&
          savedOnPage.map(({ question, index }) => {
            if (!question.sourceCrop) return null;
            const iw = question.sourceImageWidth ?? imageWidth;
            const ih = question.sourceImageHeight ?? imageHeight;
            return (
              <SavedQuestionOverlay
                key={question.id}
                index={index}
                crop={question.sourceCrop}
                imageWidth={iw}
                imageHeight={ih}
                displayWidth={displaySize.width}
                displayHeight={displaySize.height}
                onDelete={() => onDeleteSaved?.(question.id)}
              />
            );
          })}

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
          <>
            <ResizableCropBox
              crop={activeCrop}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              displayWidth={displaySize.width}
              displayHeight={displaySize.height}
              onChange={onActiveCropChange}
              accent="blue"
              zIndex={15}
            />
            {toolbarPos && (
              <CropSelectionToolbar
                left={toolbarPos.left}
                top={toolbarPos.top}
                width={toolbarPos.width}
                value={pendingAnswerKey}
                onChange={onAnswerKeyChange}
                onConfirm={onConfirmCrop}
                saving={saving}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
