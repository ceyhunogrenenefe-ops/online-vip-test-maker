"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Question } from "@/types";

interface Props {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (from: number, to: number) => void;
}

export function QuestionPanel({
  questions,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
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
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`group relative w-28 shrink-0 rounded-lg border-2 transition ${
              selectedId === q.id
                ? "border-amber-400 ring-2 ring-amber-200"
                : "border-slate-200 hover:border-dershanem-blue"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              className="block w-full p-1"
            >
              <span className="absolute left-1 top-1 z-10 rounded bg-dershanem-blue px-1.5 text-[10px] font-bold text-white">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.imageDataUrl}
                alt={`Soru ${i + 1}`}
                className="h-20 w-full rounded object-contain bg-slate-50"
              />
              {q.pdfSourceName && (
                <p className="mt-0.5 truncate px-1 text-[9px] text-slate-400">
                  {q.pdfSourceName}
                  {q.pdfPage ? ` s.${q.pdfPage}` : ""}
                </p>
              )}
            </button>
            <div className="flex border-t">
              <button
                type="button"
                onClick={() => onEdit(q.id)}
                className="flex flex-1 items-center justify-center gap-0.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={12} />
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => onDelete(q.id)}
                className="flex flex-1 items-center justify-center gap-0.5 border-l py-1 text-[10px] text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} />
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
