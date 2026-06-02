"use client";

import { Pencil, Trash2, Eraser } from "lucide-react";
import type { AnswerOption, Question } from "@/types";
import { ANSWER_OPTIONS } from "@/types";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onErase: (id: string) => void;
  onDelete: (id: string) => void;
}

export function QuestionPanel({
  questions,
  selectedId,
  onSelect,
  onEdit,
  onErase,
  onDelete,
}: Props) {
  const updateQuestion = useAppStore((s) => s.updateQuestion);

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Henüz soru eklenmedi. Kırpıp <strong>Tamam</strong> ile panele ekleyin.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-bold text-dershanem-navy">
          Seçilen sorular ({questions.length})
        </span>
        <span className="text-[10px] text-slate-400">
          Cevap anahtarını karttan düzeltin
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`w-32 shrink-0 rounded-lg border-2 transition ${
              selectedId === q.id
                ? "border-amber-400 ring-2 ring-amber-200"
                : "border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              className="block w-full p-1"
            >
              <span className="absolute z-10 hidden" />
              <span className="relative block">
                <span className="absolute left-1 top-1 z-10 rounded bg-dershanem-blue px-1.5 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={q.imageDataUrl}
                  alt={`Soru ${i + 1}`}
                  className="h-20 w-full rounded object-contain bg-slate-50"
                />
              </span>
            </button>

            <div className="flex justify-center gap-0.5 border-t bg-slate-50 px-1 py-1">
              {ANSWER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    updateQuestion(q.id, { answerKey: opt as AnswerOption })
                  }
                  className={`h-6 w-6 rounded-full text-[10px] font-bold transition ${
                    q.answerKey === opt
                      ? "bg-green-600 text-white"
                      : "bg-white border border-slate-300 text-slate-600 hover:border-dershanem-blue"
                  }`}
                  title={`Cevap: ${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex border-t text-[10px]">
              <button
                type="button"
                onClick={() => onErase(q.id)}
                className="flex flex-1 items-center justify-center gap-0.5 py-1 text-slate-600 hover:bg-slate-50"
                title="Bölge sil"
              >
                <Eraser size={11} />
                Sil
              </button>
              <button
                type="button"
                onClick={() => onEdit(q.id)}
                className="flex flex-1 items-center justify-center gap-0.5 border-l py-1 hover:bg-slate-50"
              >
                <Pencil size={11} />
                Metin
              </button>
              <button
                type="button"
                onClick={() => onDelete(q.id)}
                className="flex flex-1 items-center justify-center gap-0.5 border-l py-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
