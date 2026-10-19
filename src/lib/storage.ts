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

/* ------------------------------------------------------------------ */
/* Föy taslağı                                                         */
/* ------------------------------------------------------------------ */

const FOY_ANAHTAR = "foy-taslak";

/**
 * Föy taslağı — otomatik kayıt.
 *
 * Öğretmen 40 bloklu bir föy kurup sekmeyi yenilediğinde her şeyi
 * kaybediyordu. Bloklar formül görselleri (PNG data URL) içerebildiği
 * için localStorage yetmez; IndexedDB kullanılıyor.
 */
export type FoyTaslak = {
  bloklar: unknown[];
  kunye: {
    sinif: string;
    brans: string;
    konu: string;
    tur: string;
    dokumanAdi?: string;
    egitimYili?: string;
    donem?: string;
    yazili?: string;
    ogretmen?: string;
    website?: string;
    sinifNo?: number;
  };
  guncelleme: number;
  ogeler?: unknown[];
  tasarim?: unknown;
  belgeId?: string;
  ad?: string;
  /** Elle kaydedilen önceki haller. Otomatik kayıt bunları şişirmez. */
  surumler?: { guncelleme: number; ogeler: unknown[]; ad: string }[];
};

export type FoyBelgeOzet = {
  id: string;
  ad: string;
  guncelleme: number;
  arsiv: boolean;
};

const FOY_LISTE = "foy-belgeler";
const FOY_BELGE = "foy-belge:";
const FOY_BANKA = "foy-banka:";

export async function foyBelgeListele(): Promise<FoyBelgeOzet[]> {
  return (await get<FoyBelgeOzet[]>(FOY_LISTE)) ?? [];
}

export async function foyBelgeOku(id: string): Promise<FoyTaslak | undefined> {
  return get<FoyTaslak>(`${FOY_BELGE}${id}`);
}

export async function foyBelgeYaz(id: string, t: FoyTaslak, ozet: FoyBelgeOzet): Promise<void> {
  await set(`${FOY_BELGE}${id}`, t);
  const liste = await foyBelgeListele();
  const diger = liste.filter((b) => b.id !== id);
  await set(FOY_LISTE, [ozet, ...diger].sort((a, b) => b.guncelleme - a.guncelleme));
}

export type FoyBankaKaydi = {
  id: string;
  ders: string;
  sinif: string;
  konu: string;
  zorluk: string;
  tip: string;
  blok: unknown;
  olusturma: number;
};

export async function foyBankaListele(): Promise<FoyBankaKaydi[]> {
  const allKeys = await keys();
  const bKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(FOY_BANKA)
  ) as string[];
  const items = await Promise.all(bKeys.map((k) => get<FoyBankaKaydi>(k)));
  return items
    .filter((x): x is FoyBankaKaydi => !!x)
    .sort((a, b) => b.olusturma - a.olusturma);
}

export async function foyBankaKaydet(k: FoyBankaKaydi): Promise<void> {
  await set(`${FOY_BANKA}${k.id}`, k);
}

export async function foyBankaSil(id: string): Promise<void> {
  await del(`${FOY_BANKA}${id}`);
}

export async function saveFoyTaslak(t: FoyTaslak): Promise<void> {
  await set(FOY_ANAHTAR, t);
}

export async function getFoyTaslak(): Promise<FoyTaslak | undefined> {
  return get(FOY_ANAHTAR);
}

export async function deleteFoyTaslak(): Promise<void> {
  await del(FOY_ANAHTAR);
}
