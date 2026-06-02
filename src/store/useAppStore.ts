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
      paperSettings: { ...s.paperSettings, ...partial },
    })),
  setActiveView: (activeView) => set({ activeView }),
}));
