"use client";

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "@/store/useAppStore";
import { saveQuestion } from "@/lib/storage";
import type { Question } from "@/types";

export function QuestionEditor() {
  const addQuestion = useAppStore((s) => s.addQuestion);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(14);

  const renderToImage = (): string => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = 600;
    const h = 200;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000000";
    ctx.font = `${fontSize}px Segoe UI, sans-serif`;
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, 16, 24 + i * (fontSize + 6));
    });
    return canvas.toDataURL("image/png");
  };

  const save = async () => {
    if (!text.trim()) {
      alert("Soru metni girin.");
      return;
    }
    const dataUrl = renderToImage();
    const q: Question = {
      id: uuidv4(),
      imageDataUrl: dataUrl,
      source: "editor",
      createdAt: Date.now(),
    };
    await saveQuestion(q);
    addQuestion(q);
    setText("");
    alert("Soru kaydedildi ve taslağa eklendi.");
  };

  return (
    <div className="m-4 flex flex-1 flex-col rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold text-dershanem-navy">
        Soru Editörü
      </h2>
      <div className="mb-3 flex gap-4">
        <label className="text-sm">
          Yazı boyutu
          <input
            type="number"
            min={10}
            max={24}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="ml-2 w-16 rounded border px-2"
          />
        </label>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Soru metnini yazın... (Matematik için LaTeX desteği yakında)"
        className="mb-4 min-h-[120px] w-full rounded border p-3 font-mono text-sm"
      />
      <div className="mb-4 rounded border bg-slate-50 p-4">
        <p className="mb-2 text-xs text-slate-500">Önizleme</p>
        <pre className="whitespace-pre-wrap text-sm">{text || "..."}</pre>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={save}
        className="self-end rounded-lg bg-dershanem-blue px-6 py-2 font-medium text-white hover:bg-blue-700"
      >
        Yükle / Kaydet
      </button>
    </div>
  );
}
