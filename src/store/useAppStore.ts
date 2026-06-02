import { create } from "zustand";
import type { PaperSettings, Question } from "@/types";
import { DEFAULT_PAPER_SETTINGS } from "@/types";

interface AppState {
  questions: Question[];
  draftIds: string[];
  paperSettings: PaperSettings;
  activeView:
    | "home"
    | "crop"
    | "editor"
    | "online"
    | "advanced";
  setQuestions: (q: Question[]) => void;
  addQuestion: (q: Question) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  setDraftIds: (ids: string[]) => void;
  addToDraft: (id: string) => void;
  removeFromDraft: (id: string) => void;
  reorderDraft: (ids: string[]) => void;
  setPaperSettings: (s: Partial<PaperSettings>) => void;
  setActiveView: (v: AppState["activeView"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  questions: [],
  draftIds: [],
  paperSettings: { ...DEFAULT_PAPER_SETTINGS },
  activeView: "home",
  setQuestions: (questions) => set({ questions }),
  addQuestion: (q) =>
    set((s) => ({
      questions: [q, ...s.questions.filter((x) => x.id !== q.id)],
      draftIds: s.draftIds.includes(q.id)
        ? s.draftIds
        : [...s.draftIds, q.id],
    })),
  updateQuestion: (id, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q
      ),
    })),
  removeQuestion: (id) =>
    set((s) => ({
      questions: s.questions.filter((x) => x.id !== id),
      draftIds: s.draftIds.filter((x) => x !== id),
    })),
  setDraftIds: (draftIds) => set({ draftIds }),
  addToDraft: (id) =>
    set((s) =>
      s.draftIds.includes(id) ? s : { draftIds: [...s.draftIds, id] }
    ),
  removeFromDraft: (id) =>
    set((s) => ({ draftIds: s.draftIds.filter((x) => x !== id) })),
  reorderDraft: (draftIds) => set({ draftIds }),
  setPaperSettings: (partial) =>
    set((s) => ({
      paperSettings: {
        ...s.paperSettings,
        ...partial,
        columnDivider:
          partial.columnDivider ??
          (partial.columns !== undefined
            ? partial.columns >= 2
            : s.paperSettings.columnDivider),
      },
    })),
  setActiveView: (activeView) => set({ activeView }),
}));
