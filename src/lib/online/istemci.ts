"use client";

import { saveOnlineExam } from "@/lib/storage";
import type { OnlineExam } from "@/types";

export type SunucuTeslim = {
  studentName: string;
  answers: Record<number, string>;
  submittedAt: number;
  score: number;
  total: number;
};

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(yol, govde === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  const j = (await r.json().catch(() => ({}))) as T & { hata?: string };
  if (!r.ok) throw new Error(j.hata || "Sunucuya ulaşılamadı.");
  return j;
}

/** Öğrenciye verilecek link. NEXT_PUBLIC_SINAV_ADRES tanımlıysa (özel alan adı) o kullanılır. */
export function onlineTestLinki(id: string) {
  const taban = process.env.NEXT_PUBLIC_SINAV_ADRES || window.location.origin;
  return `${taban.replace(/\/$/, "")}/exam/${id}`;
}

/** Testi görselleriyle sunucuya yükler; böylece link her cihazda açılır. */
export async function sunucuyaYukle(exam: OnlineExam, ilerleme?: (yuklenen: number, toplam: number) => void) {
  const sorular = exam.questionSnapshots;
  for (let i = 0; i < sorular.length; i++) {
    ilerleme?.(i, sorular.length);
    await istek("/api/online", { op: "gorsel", id: exam.id, n: i, veri: sorular[i].imageDataUrl });
  }
  await istek("/api/online", {
    op: "yayinla",
    id: exam.id,
    title: exam.title,
    schoolName: exam.schoolName,
    durationMinutes: exam.durationMinutes,
    createdAt: exam.createdAt,
    sorular: sorular.map((s) => ({ id: s.id, answerKey: s.answerKey ?? null })),
  });
  ilerleme?.(sorular.length, sorular.length);
  const guncel = { ...exam, sunucuda: true };
  await saveOnlineExam(guncel);
  return guncel;
}

export async function sunucudaVarMi(id: string) {
  return (await istek<{ var: boolean }>(`/api/online?op=var&id=${encodeURIComponent(id)}`)).var;
}

export async function sunucuTeslimleri(id: string) {
  return (await istek<{ teslimler: SunucuTeslim[] }>(`/api/online?id=${encodeURIComponent(id)}`)).teslimler;
}

export async function sunucudanSil(id: string) {
  await istek("/api/online", { op: "sil", id });
}

export type OgrenciTesti = {
  id: string;
  title: string;
  schoolName: string;
  durationMinutes?: number;
  sorular: { id: string; gorsel: string }[];
};

/** Bulunamazsa null döner. */
export async function ogrenciTestiGetir(id: string): Promise<OgrenciTesti | null> {
  const r = await fetch(`/api/online/sinav?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (r.status === 404) return null;
  const j = (await r.json().catch(() => ({}))) as OgrenciTesti & { hata?: string };
  if (!r.ok) throw new Error(j.hata || "Sınav yüklenemedi.");
  return j;
}

export async function testTeslimEt(id: string, studentName: string, answers: Record<number, string>) {
  return istek<{ score: number; total: number }>("/api/online/sinav", { id, studentName, answers });
}
