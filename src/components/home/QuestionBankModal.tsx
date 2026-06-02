"use client";

import { useAppStore } from "@/store/useAppStore";

interface Props {
  onClose: () => void;
}

export function QuestionBankModal({ onClose }: Props) {
  const questions = useAppStore((s) => s.questions);
  const draftIds = useAppStore((s) => s.draftIds);
  const addToDraft = useAppStore((s) => s.addToDraft);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);

  const add = (id: string) => {
    addToDraft(id);
    void saveCurrentProject();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Soru Bankası</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {questions.length === 0 ? (
            <p className="col-span-full py-8 text-center text-slate-500">
              Henüz kayıtlı soru yok. Kırpma aracı ile ekleyin.
            </p>
          ) : (
            questions.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => add(q.id)}
                disabled={draftIds.includes(q.id)}
                className="rounded-lg border p-2 text-left hover:border-dershanem-blue disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={q.imageDataUrl}
                  alt="Soru"
                  className="h-24 w-full object-contain"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {draftIds.includes(q.id) ? "Eklendi" : "Ekle"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
