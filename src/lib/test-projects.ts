import { get, set, del, keys } from "idb-keyval";
import { v4 as uuidv4 } from "uuid";
import type { PaperSettings, TestProject, TestProjectSummary } from "@/types";
import { DEFAULT_PAPER_SETTINGS } from "@/types";

const PROJECT_PREFIX = "project:";
const CURRENT_PROJECT_KEY = "project:current";
const LEGACY_DRAFT_KEY = "draft:paper";

function projectKey(id: string) {
  return `${PROJECT_PREFIX}${id}`;
}

export function projectDisplayName(
  name: string,
  paperSettings: PaperSettings
): string {
  const t = name.trim() || paperSettings.testName?.trim();
  return t || "İsimsiz test";
}

export async function saveTestProject(project: TestProject): Promise<void> {
  await set(projectKey(project.id), {
    ...project,
    updatedAt: Date.now(),
  });
}

export async function getTestProject(
  id: string
): Promise<TestProject | undefined> {
  return get<TestProject>(projectKey(id));
}

export async function getAllTestProjects(): Promise<TestProject[]> {
  const allKeys = await keys();
  const pKeys = allKeys.filter(
    (k) =>
      typeof k === "string" &&
      k.startsWith(PROJECT_PREFIX) &&
      k !== CURRENT_PROJECT_KEY &&
      k.length > PROJECT_PREFIX.length
  ) as string[];
  const items = await Promise.all(pKeys.map((k) => get<TestProject>(k)));
  return items
    .filter((p): p is TestProject => !!p)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteTestProject(id: string): Promise<void> {
  await del(projectKey(id));
}

export async function getCurrentProjectId(): Promise<string | null> {
  return (await get<string>(CURRENT_PROJECT_KEY)) ?? null;
}

export async function setCurrentProjectId(id: string): Promise<void> {
  await set(CURRENT_PROJECT_KEY, id);
}

export function toSummary(p: TestProject): TestProjectSummary {
  return {
    id: p.id,
    name: projectDisplayName(p.name, p.paperSettings),
    updatedAt: p.updatedAt,
    draftCount: p.draftIds.length,
  };
}

export function createEmptyProject(name?: string): TestProject {
  const now = Date.now();
  const paperSettings: PaperSettings = {
    ...DEFAULT_PAPER_SETTINGS,
    testName: name?.trim() || "",
  };
  return {
    id: uuidv4(),
    name: name?.trim() || paperSettings.testName || "Yeni test",
    createdAt: now,
    updatedAt: now,
    draftIds: [],
    paperSettings,
  };
}

/** Eski tek taslağı ilk projeye taşır */
export async function migrateLegacyDraftIfNeeded(): Promise<TestProject | null> {
  const existing = await getAllTestProjects();
  if (existing.length > 0) return null;

  const legacyIds = await get<string[]>(LEGACY_DRAFT_KEY);
  const project = createEmptyProject();
  if (legacyIds?.length) {
    project.draftIds = legacyIds;
    project.name = "Kayıtlı taslak";
    project.paperSettings.testName = project.name;
  }
  await saveTestProject(project);
  await setCurrentProjectId(project.id);
  return project;
}
