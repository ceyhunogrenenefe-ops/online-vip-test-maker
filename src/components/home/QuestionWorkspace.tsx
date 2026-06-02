"use client";

import { useRef, useState } from "react";
import {
  Upload,
  Crop,
  Pencil,
  RotateCcw,
  GripVertical,
  X,
  ImagePlus,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "@/store/useAppStore";
import { saveQuestion } from "@/lib/storage";
import { ANSWER_OPTIONS } from "@/types";
import type { AnswerOption } from "@/types";
import { readFileAsDataUrl } from "@/lib/crop";
import type { Question } from "@/types";
import { QuestionBankModal } from "./QuestionBankModal";

export function QuestionWorkspace() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const questions = useAppStore((s) => s.questions);
  const draftIds = useAppStore((s) => s.draftIds);
  const addQuestion = useAppStore((s) => s.addQuestion);
  const removeFromDraft = useAppStore((s) => s.removeFromDraft);
  const reorderDraft = useAppStore((s) => s.reorderDraft);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const updateQuestion = useAppStore((s) => s.updateQuestion);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const draftQuestions = draftIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is Question => !!q);

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const q: Question = {
        id: uuidv4(),
        imageDataUrl: dataUrl,
        source: "upload",
        createdAt: Date.now(),
      };
      await saveQuestion(q);
      addQuestion(q);
    }
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...draftIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderDraft(next);
    void saveCurrentProject();
  };

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {draftQuestions.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length)
                uploadFiles(e.dataTransfer.files);
            }}
            className={`flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${
              dragOver
                ? "drop-zone-active"
                : "border-slate-300 bg-dershanem-sky/30"
            }`}
          >
            <Upload size={72} className="mb-4 text-dershanem-blue/80" />
            <p className="mb-6 text-center text-lg font-medium text-slate-700">
              Soru seçin veya bu alana sürükleyin
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 text-sm text-slate-600 hover:text-dershanem-blue"
              >
                <ImagePlus size={32} />
                Cihazdan Seçin
              </button>
              <button
                type="button"
                onClick={() => setActiveView("crop")}
                className="flex flex-col items-center gap-2 text-sm text-slate-600 hover:text-dershanem-blue"
              >
                <Crop size={32} />
                Kırpma Aracı
              </button>
              <button
                type="button"
                onClick={() => setActiveView("editor")}
                className="flex flex-col items-center gap-2 text-sm text-slate-600 hover:text-dershanem-blue"
              >
                <Pencil size={32} />
                Soru Editörü
              </button>
              <button
                type="button"
                onClick={() => setShowBank(true)}
                className="flex flex-col items-center gap-2 text-sm text-slate-600 hover:text-dershanem-blue"
              >
                <RotateCcw size={32} />
                Soru Bankası
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-dershanem-navy">
                Sınav soruları ({draftQuestions.length})
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-white"
                >
                  + Görsel ekle
                </button>
                <button
                  type="button"
                  onClick={() => setShowBank(true)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-white"
                >
                  Bankadan ekle
                </button>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
              {draftQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className="group relative rounded-xl border-2 border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="mb-2 text-sm font-bold text-dershanem-navy">
                    {i + 1}. Soru
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={q.imageDataUrl}
                    alt={`Soru ${i + 1}`}
                    className="max-h-56 w-full rounded object-contain bg-slate-50"
                  />
                  <div className="mt-2 flex justify-center gap-1">
                    {ANSWER_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          updateQuestion(q.id, {
                            answerKey: opt as AnswerOption,
                          })
                        }
                        className={`h-8 w-8 rounded-full text-sm font-bold transition ${
                          q.answerKey === opt
                            ? "bg-dershanem-blue text-white"
                            : "border border-slate-300 bg-white text-slate-600 hover:border-dershanem-blue"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between opacity-0 transition group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(i, -1)}
                        disabled={i === 0}
                        className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                        title="Yukarı"
                      >
                        <GripVertical size={16} className="rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(i, 1)}
                        disabled={i === draftQuestions.length - 1}
                        className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                        title="Aşağı"
                      >
                        <GripVertical size={16} className="-rotate-90" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeFromDraft(q.id);
                        void saveCurrentProject();
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
              }}
            />
          </div>
        )}
      </div>

      {showBank && <QuestionBankModal onClose={() => setShowBank(false)} />}
    </>
  );
}
