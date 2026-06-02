"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, Square } from "lucide-react";
import { saveQuestion } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";
import type { Question } from "@/types";

type Tool = "brush" | "rect";

interface Props {
  question: Question;
  onClose: () => void;
}

export function QuestionImageEraser({ question, onClose }: Props) {
  const updateQuestion = useAppStore((s) => s.updateQuestion);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(28);
  const [drawing, setDrawing] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const initCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxW = 720;
    const scale = img.width > maxW ? maxW / img.width : 1;
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    imageRef.current = img;
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => initCanvas(img);
    img.src = question.imageDataUrl;
  }, [question.imageDataUrl]);

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
    setDrawing(true);
    const p = coords(e);
    if (tool === "brush") {
      paintWhite(p.x, p.y, brushSize);
    } else {
      setRectStart(p);
    }
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = coords(e);
    if (tool === "brush") {
      paintWhite(p.x, p.y, brushSize);
    }
  };

  const onUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
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

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    const finalUrl = canvas.toDataURL("image/png");
    updateQuestion(question.id, { imageDataUrl: finalUrl });
    await saveQuestion({ ...question, imageDataUrl: finalUrl });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-bold text-dershanem-navy">İstediğiniz yeri silin</h2>
          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-b px-4 py-2">
          <button
            type="button"
            onClick={() => setTool("brush")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
              tool === "brush" ? "bg-dershanem-blue text-white" : "border"
            }`}
          >
            <Eraser size={14} />
            Silgi
          </button>
          <button
            type="button"
            onClick={() => setTool("rect")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
              tool === "rect" ? "bg-dershanem-blue text-white" : "border"
            }`}
          >
            <Square size={14} />
            Alan sil
          </button>
          {tool === "brush" && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              Fırça
              <input
                type="range"
                min={10}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full cursor-crosshair border-2 border-slate-300 bg-white shadow-lg"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => setDrawing(false)}
          />
        </div>
        <div className="flex gap-2 border-t p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded border py-2">
            İptal
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-dershanem-blue py-2 font-semibold text-white"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
