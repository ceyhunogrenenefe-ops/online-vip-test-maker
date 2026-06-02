import { get, set, del, keys } from "idb-keyval";
import type { Question, OnlineExam } from "@/types";

const Q_PREFIX = "q:";
const EXAM_PREFIX = "exam:";
const DRAFT_KEY = "draft:paper";

export async function saveQuestion(q: Question): Promise<void> {
  await set(`${Q_PREFIX}${q.id}`, q);
}

export async function getQuestion(id: string): Promise<Question | undefined> {
  return get<Question>(`${Q_PREFIX}${id}`);
}

export async function getAllQuestions(): Promise<Question[]> {
  const allKeys = await keys();
  const qKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(Q_PREFIX)
  ) as string[];
  const items = await Promise.all(
    qKeys.map((k) => get<Question>(k))
  );
  return items
    .filter((q): q is Question => !!q)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteQuestion(id: string): Promise<void> {
  await del(`${Q_PREFIX}${id}`);
}

export async function saveOnlineExam(exam: OnlineExam): Promise<void> {
  await set(`${EXAM_PREFIX}${exam.id}`, exam);
}

export async function getOnlineExam(id: string): Promise<OnlineExam | undefined> {
  return get<OnlineExam>(`${EXAM_PREFIX}${id}`);
}

export async function getAllOnlineExams(): Promise<OnlineExam[]> {
  const allKeys = await keys();
  const eKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(EXAM_PREFIX)
  ) as string[];
  const items = await Promise.all(
    eKeys.map((k) => get<OnlineExam>(k))
  );
  return items
    .filter((e): e is OnlineExam => !!e)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteOnlineExam(id: string): Promise<void> {
  await del(`${EXAM_PREFIX}${id}`);
}

/** @deprecated Proje kaydı için useAppStore.saveCurrentProject kullanın */
export async function saveDraftQuestionIds(ids: string[]): Promise<void> {
  await set(DRAFT_KEY, ids);
}

/** @deprecated hydrateProjects kullanın */
export async function getDraftQuestionIds(): Promise<string[]> {
  return (await get<string[]>(DRAFT_KEY)) ?? [];
}
