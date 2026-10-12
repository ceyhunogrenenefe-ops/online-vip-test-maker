"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Eraser, Loader2, Square, X } from "lucide-react";
import type { AnswerOption } from "@/types";
import { ANSWER_OPTIONS } from "@/types";
import type { PixelCrop } from "@/lib/crop";
import { composeQuestionPreview } from "@/lib/question-render";

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Segoe UI", value: "Segoe UI, Arial, sans-serif" },
  { label: "Times", value: "Times New Roman, serif" },
  { label: "Calibri", value: "Calibri, Arial, sans-serif" },
];

export type PreUploadEditResult = {
  imageDataUrl: string;
  overlayText?: string;
  fontSize: number;
  fontFamily: string;
  fontBold: boolean;
  answerKey?: AnswerOption;
  sourceCrop: PixelCrop;
};

type Tool = "none" | "brush" | "rect";

interface Props {
  imageDataUrl: string;
  sourceCrop: PixelCrop;
  initialAnswerKey: AnswerOption | null;
  onCancel: () => void;
  onConfirm: (result: PreUploadEditResult) => void;
  saving?: boolean;
}

export function PreUploadQuestionEditor({
  imageDataUrl,
  sourceCrop,
  initialAnswerKey,
  onCancel,
  onConfirm,
  saving = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [brushSize, setBrushSize] = useState(24);
  const [drawing, setDrawing] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [baseImage, setBaseImage] = useState(imageDataUrl);
  const [overlayText, setOverlayText] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontBold, setFontBold] = useState(false);
  const [answerKey, setAnswerKey] = useState<AnswerOption | null>(
    initialAnswerKey
  );
  const [previewUrl, setPreviewUrl] = useState(imageDataUrl);
  const [ready, setReady] = useState(false);

  const initCanvas = (url: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 640;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setReady(true);
    };
    img.src = url;
  };

  useEffect(() => {
    setBaseImage(imageDataUrl);
    initCanvas(imageDataUrl);
  }, [imageDataUrl]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const src = canvas && ready ? canvas.toDataURL("image/png") : baseImage;
    composeQuestionPreview(src, {
      overlayText,
      fontSize,
      fontFamily,
      fontBold,
    }).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [baseImage, overlayText, fontSize, fontFamily, fontBold, ready, drawing]);

  const coords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const paintWhite = (x: number, y: number, size: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const paintRect = (x: number, y: number, w: number, h: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, w, h);
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "none") return;
    setDrawing(true);
    const p = coords(e);
    if (tool === "brush") paintWhite(p.x, p.y, brushSize);
    else setRectStart(p);
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || tool === "none") return;
    const p = coords(e);
    if (tool === "brush") paintWhite(p.x, p.y, brushSize);
  };

  const onUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || tool === "none") return;
    setDrawing(false);
    if (tool === "rect" && rectStart) {
      const p = coords(e);
      paintRect(
        Math.min(rectStart.x, p.x),
        Math.min(rectStart.y, p.y),
        Math.abs(p.x - rectStart.x),
        Math.abs(p.y - rectStart.y)
      );
      setRectStart(null);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const image = canvas ? canvas.toDataURL("image/png") : baseImage;
    onConfirm({
      imageDataUrl: image,
      overlayText: overlayText.trim() || undefined,
      fontSize,
      fontFamily,
      fontBold,
      answerKey: answerKey ?? undefined,
      sourceCrop,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-2">
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {[12, 14, 16, 18, 20, 22].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFontBold((b) => !b)}
            className={`flex h-9 w-9 items-center justify-center rounded border text-sm font-bold ${
              fontBold
                ? "border-dershanem-blue bg-dershanem-blue text-white"
                : "border-slate-300 bg-white"
            }`}
            title="Kalın"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => setTool((t) => (t === "brush" ? "none" : "brush"))}
            className={`flex h-9 w-9 items-center justify-center rounded border ${
              tool === "brush"
                ? "border-dershanem-blue bg-dershanem-sky"
                : "border-slate-300 bg-white"
            }`}
            title="Silgi"
          >
            <Eraser size={16} />
          </button>
          <button
            type="button"
            onClick={() => setTool((t) => (t === "rect" ? "none" : "rect"))}
            className={`flex h-9 w-9 items-center justify-center rounded border ${
              tool === "rect"
                ? "border-dershanem-blue bg-dershanem-sky"
                : "border-slate-300 bg-white"
            }`}
            title="Alan sil"
          >
            <Square size={16} />
          </button>
          {tool !== "none" && (
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
              Silgi
              <input
                type="range"
                min={8}
                max={64}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto rounded p-1.5 text-slate-400 hover:bg-slate-200 lg:ml-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-center rounded-lg border-2 border-red-400 bg-white p-2">
            <canvas
              ref={canvasRef}
              className={`max-w-full bg-white ${
                tool !== "none" ? "cursor-crosshair" : "cursor-default"
              }`}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={() => setDrawing(false)}
            />
          </div>

          <textarea
            value={overlayText}
            onChange={(e) => setOverlayText(e.target.value)}
            rows={2}
            placeholder="Soru metni veya açıklama ekleyin…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            style={{
              fontFamily,
              fontSize,
              fontWeight: fontBold ? "bold" : "normal",
            }}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="mb-1 text-[10px] font-medium uppercase text-slate-500">
              Önizleme
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Soru önizleme"
              className="mx-auto max-h-40 max-w-full object-contain"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t bg-white px-4 py-3">
          {ANSWER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAnswerKey(opt)}
              className={`h-9 min-w-[2.25rem] rounded px-2 text-sm font-bold ${
                answerKey === opt
                  ? "bg-dershanem-blue text-white"
                  : "bg-sky-100 text-dershanem-navy hover:bg-sky-200"
              }`}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="ml-auto flex min-w-[5rem] items-center justify-center gap-1 rounded-lg bg-dershanem-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
