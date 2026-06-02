import { create } from "zustand";
import type { PaperSettings, Question, TestProjectSummary } from "@/types";
import { DEFAULT_PAPER_SETTINGS } from "@/types";
import {
  bootstrapProjects,
  createNewProjectRecord,
  deleteTestProject,
  loadProjectIntoState,
  loadProjectSummaries,
  persistProject,
} from "./project-actions";

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
  currentProjectId: string | null;
  projects: TestProjectSummary[];
  projectsReady: boolean;
  lastSavedAt: number | null;
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
  hydrateProjects: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  createNewProject: (name?: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  questions: [],
  draftIds: [],
  paperSettings: { ...DEFAULT_PAPER_SETTINGS },
  activeView: "home",
  currentProjectId: null,
  projects: [],
  projectsReady: false,
  lastSavedAt: null,

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

  hydrateProjects: async () => {
    const data = await bootstrapProjects();
    set({
      currentProjectId: data.currentId,
      draftIds: data.draftIds,
      paperSettings: data.paperSettings,
      projects: data.summaries,
      projectsReady: true,
    });
  },

  saveCurrentProject: async () => {
    const { currentProjectId, draftIds, paperSettings } = get();
    if (!currentProjectId) return;
    const project = await persistProject(
      currentProjectId,
      draftIds,
      paperSettings
    );
    const summaries = await loadProjectSummaries();
    set({
      projects: summaries,
      lastSavedAt: project.updatedAt,
    });
  },

  switchProject: async (id) => {
    const state = get();
    if (id === state.currentProjectId) return;
    if (state.currentProjectId) {
      await persistProject(
        state.currentProjectId,
        state.draftIds,
        state.paperSettings
      );
    }
    const loaded = await loadProjectIntoState(id);
    if (!loaded) return;
    const summaries = await loadProjectSummaries();
    set({
      currentProjectId: id,
      draftIds: loaded.draftIds,
      paperSettings: loaded.paperSettings,
      projects: summaries,
      activeView: "home",
    });
  },

  createNewProject: async (name) => {
    const state = get();
    if (state.currentProjectId) {
      await persistProject(
        state.currentProjectId,
        state.draftIds,
        state.paperSettings
      );
    }
    const p = await createNewProjectRecord(name);
    const summaries = await loadProjectSummaries();
    set({
      currentProjectId: p.id,
      draftIds: [],
      paperSettings: { ...p.paperSettings },
      projects: summaries,
      activeView: "home",
      lastSavedAt: p.updatedAt,
    });
  },

  removeProject: async (id) => {
    const state = get();
    const list = state.projects;
    if (list.length <= 1) {
      alert("Son test silinemez. Yeni test oluşturup sonra silebilirsiniz.");
      return;
    }
    await deleteTestProject(id);
    let nextId = state.currentProjectId;
    if (id === state.currentProjectId) {
      const remaining = list.filter((p) => p.id !== id);
      nextId = remaining[0]?.id ?? null;
      if (nextId) {
        const loaded = await loadProjectIntoState(nextId);
        if (loaded) {
          const summaries = await loadProjectSummaries();
          set({
            currentProjectId: nextId,
            draftIds: loaded.draftIds,
            paperSettings: loaded.paperSettings,
            projects: summaries,
          });
          return;
        }
      }
    }
    const summaries = await loadProjectSummaries();
    set({ projects: summaries });
  },
}));
