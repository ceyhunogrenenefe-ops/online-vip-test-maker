"use client";

import { useState } from "react";
import { X, Maximize2, Type } from "lucide-react";
import type { AnswerOption, Question } from "@/types";
import { expandQuestionImage } from "@/lib/question-render";
import { useAppStore } from "@/store/useAppStore";
import { AnswerKeyPicker } from "@/components/AnswerKeyPicker";

interface Props {
  question: Question;
  onClose: () => void;
}

export function QuestionEditModal({ question, onClose }: Props) {
  const updateQuestion = useAppStore((s) => s.updateQuestion);
  const [text, setText] = useState(question.overlayText ?? "");
  const [fontSize, setFontSize] = useState(question.fontSize ?? 14);
  const [preview, setPreview] = useState(question.imageDataUrl);
  const [expanding, setExpanding] = useState(false);
  const [answerKey, setAnswerKey] = useState<AnswerOption | undefined>(
    question.answerKey
  );

  const save = () => {
    updateQuestion(question.id, {
      overlayText: text,
      fontSize,
      imageDataUrl: preview,
      answerKey,
    });
    onClose();
  };

  const handleExpand = async (percent: number) => {
    setExpanding(true);
    try {
      const url = await expandQuestionImage(preview, percent);
      setPreview(url);
    } finally {
      setExpanding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-bold text-dershanem-navy">Soru düzenle</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-lg border bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Soru"
              className="mx-auto max-h-48 max-w-full object-contain"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={expanding}
              onClick={() => handleExpand(5)}
              className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Maximize2 size={14} />
              Biraz genişlet
            </button>
            <button
              type="button"
              disabled={expanding}
              onClick={() => handleExpand(12)}
              className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Maximize2 size={14} />
              Çok genişlet
            </button>
          </div>

          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1 font-medium">
              <Type size={14} />
              Metin ekle (soru altına yazılır)
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Örn: 1.1 Genlik ve dalga boyu kavramlarını tanımlayınız."
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <AnswerKeyPicker
            value={answerKey}
            onChange={setAnswerKey}
            label="Cevap anahtarı (doğru şık)"
          />

          <label className="block text-sm">
            Yazı boyutu
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value={12}>12</option>
              <option value={14}>14</option>
              <option value={16}>16</option>
              <option value={18}>18</option>
              <option value={20}>20</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-lg bg-dershanem-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
