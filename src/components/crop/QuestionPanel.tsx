"use client";

import { useCallback, useState } from "react";
import {
  Pencil,
  Trash2,
  Eraser,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Columns2,
  Maximize2,
  Sparkles,
} from "lucide-react";
import type { AnswerOption, Question, QuestionLayoutSpan } from "@/types";
import { ANSWER_OPTIONS, LAYOUT_SPAN_LABELS } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { sortDraftIdsByVisualSize } from "@/lib/pdf-layout";

const LAYOUT_CYCLE: QuestionLayoutSpan[] = ["auto", "column", "full"];

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
  const draftIds = useAppStore((s) => s.draftIds);
  const reorderDraft = useAppStore((s) => s.reorderDraft);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const allQuestions = useAppStore((s) => s.questions);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);

  const persistOrder = useCallback(
    (ids: string[]) => {
      reorderDraft(ids);
      void saveCurrentProject();
    },
    [reorderDraft, saveCurrentProject]
  );

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...draftIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = draftIds.indexOf(dragId);
    const to = draftIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...draftIds];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    persistOrder(next);
    setDragId(null);
  };

  const cycleLayout = (q: Question) => {
    const cur = q.layoutSpan ?? "auto";
    const idx = LAYOUT_CYCLE.indexOf(cur);
    const next = LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length];
    updateQuestion(q.id, { layoutSpan: next });
  };

  const autoSortBySize = async () => {
    setSorting(true);
    try {
      const sorted = await sortDraftIdsByVisualSize(draftIds, allQuestions);
      persistOrder(sorted);
    } finally {
      setSorting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Henüz soru eklenmedi. Kırpıp <strong>Tamam</strong> ile panele ekleyin.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-bold text-dershanem-navy">
          Seçilen sorular ({questions.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={sorting || questions.length < 2}
            onClick={() => void autoSortBySize()}
            className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title="Uzun soruları öne al (PDF yerleşimi)"
          >
            <Sparkles size={12} />
            {sorting ? "Sıralanıyor…" : "Akıllı sırala"}
          </button>
          <span className="text-[10px] text-slate-400">
            Sürükleyerek sırayı değiştirin
          </span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            draggable
            onDragStart={() => setDragId(q.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(q.id)}
            className={`w-36 shrink-0 rounded-lg border-2 transition ${
              selectedId === q.id
                ? "border-amber-400 ring-2 ring-amber-200"
                : dragId === q.id
                  ? "border-dershanem-blue opacity-70"
                  : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between border-b bg-slate-50 px-1 py-0.5">
              <GripVertical
                size={14}
                className="cursor-grab text-slate-400 active:cursor-grabbing"
              />
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => moveQuestion(i, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 hover:bg-white disabled:opacity-30"
                  title="Sola taşı"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(i, 1)}
                  disabled={i === questions.length - 1}
                  className="rounded p-0.5 hover:bg-white disabled:opacity-30"
                  title="Sağa taşı"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelect(q.id)}
              className="block w-full p-1"
            >
              <span className="relative block">
                <span className="absolute left-1 top-1 z-10 rounded bg-dershanem-blue px-1.5 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={q.imageDataUrl}
                  alt={`Soru ${i + 1}`}
                  className="h-24 w-full rounded object-contain bg-slate-50"
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => cycleLayout(q)}
              className="flex w-full items-center justify-center gap-1 border-t bg-blue-50/80 px-1 py-1 text-[9px] font-medium text-dershanem-navy hover:bg-blue-100"
              title="Kağıt yerleşimi: otomatik / sütun / tam genişlik"
            >
              {(q.layoutSpan ?? "auto") === "full" ? (
                <Maximize2 size={10} />
              ) : (
                <Columns2 size={10} />
              )}
              {LAYOUT_SPAN_LABELS[q.layoutSpan ?? "auto"]}
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
                      : "border border-slate-300 bg-white text-slate-600 hover:border-dershanem-blue"
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
