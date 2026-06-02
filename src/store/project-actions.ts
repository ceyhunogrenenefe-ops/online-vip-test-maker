import type { PaperSettings, TestProject, TestProjectSummary } from "@/types";
import {
  createEmptyProject,
  deleteTestProject,
  getAllTestProjects,
  getCurrentProjectId,
  getTestProject,
  migrateLegacyDraftIfNeeded,
  projectDisplayName,
  saveTestProject,
  setCurrentProjectId,
  toSummary,
} from "@/lib/test-projects";

export async function loadProjectSummaries(): Promise<TestProjectSummary[]> {
  const list = await getAllTestProjects();
  return list.map(toSummary);
}

export async function persistProject(
  id: string,
  draftIds: string[],
  paperSettings: PaperSettings,
  existing?: TestProject
): Promise<TestProject> {
  const base =
    existing ??
    (await getTestProject(id)) ??
    createEmptyProject(paperSettings.testName);
  const project: TestProject = {
    ...base,
    id,
    draftIds: [...draftIds],
    paperSettings: { ...paperSettings },
    name: projectDisplayName(base.name, paperSettings),
    updatedAt: Date.now(),
  };
  await saveTestProject(project);
  await setCurrentProjectId(id);
  return project;
}

export async function loadProjectIntoState(
  id: string
): Promise<{ draftIds: string[]; paperSettings: PaperSettings } | null> {
  const p = await getTestProject(id);
  if (!p) return null;
  await setCurrentProjectId(id);
  return { draftIds: [...p.draftIds], paperSettings: { ...p.paperSettings } };
}

export async function bootstrapProjects(): Promise<{
  currentId: string;
  draftIds: string[];
  paperSettings: PaperSettings;
  summaries: TestProjectSummary[];
}> {
  await migrateLegacyDraftIfNeeded();
  let list = await getAllTestProjects();
  if (list.length === 0) {
    const p = createEmptyProject();
    await saveTestProject(p);
    await setCurrentProjectId(p.id);
    list = [p];
  }

  let currentId = await getCurrentProjectId();
  if (!currentId || !list.some((p) => p.id === currentId)) {
    currentId = list[0].id;
    await setCurrentProjectId(currentId);
  }

  const current = list.find((p) => p.id === currentId)!;
  return {
    currentId,
    draftIds: [...current.draftIds],
    paperSettings: { ...current.paperSettings },
    summaries: list.map(toSummary),
  };
}

export async function createNewProjectRecord(
  name?: string
): Promise<TestProject> {
  const p = createEmptyProject(name);
  await saveTestProject(p);
  await setCurrentProjectId(p.id);
  return p;
}

export { deleteTestProject, getAllTestProjects };
