/**
 * Tarayıcı tarafı: ortak soru havuzuna gönderme, okuma ve eşitleme.
 * Sorular yine tarayıcıda da tutulur (hızlı açılış, çevrimdışı çalışma);
 * havuz herkesin gördüğü ortak kopyadır.
 */

import { get, set } from "idb-keyval";
import type { Question } from "@/types";

export type Ekleyen = { id: string; ad: string };

export type HavuzSoru = {
  id: string;
  ekleyen: Ekleyen;
  createdAt: number;
  guncelleme: number;
  source?: string;
  label?: string;
  pdfSourceName?: string;
  pdfPage?: number;
  answerKey?: string;
};

export type HavuzBanka = {
  id: string;
  ekleyen: Ekleyen;
  olusturma: number;
  ders: string;
  sinif: string;
  konu: string;
  zorluk: string;
  tip: string;
  etiket: string;
};

export type HavuzListe = {
  sorular: HavuzSoru[];
  banka: HavuzBanka[];
  ben: { id: string; ad: string; yonetici: boolean };
};

export type BankaGonder = {
  id: string;
  ders: string;
  sinif: string;
  konu: string;
  zorluk: string;
  tip: string;
  blok: unknown;
  olusturma: number;
  etiket: string;
};

const REDDEDILEN = "havuz:silinen";

async function jsonIste<T>(adres: string, init?: RequestInit): Promise<T> {
  const r = await fetch(adres, { cache: "no-store", ...init });
  const j = (await r.json().catch(() => null)) as (T & { hata?: string }) | null;
  if (!r.ok || !j) throw new Error(j?.hata || "Soru havuzuna ulaşılamadı.");
  return j;
}

export function havuzListele(): Promise<HavuzListe> {
  return jsonIste<HavuzListe>("/api/havuz");
}

export function havuzGorselAdresi(s: HavuzSoru): string {
  return `/api/havuz/soru/${encodeURIComponent(s.id)}/gorsel?v=${s.guncelleme}`;
}

export function havuzSoruGetir(id: string): Promise<Question> {
  return jsonIste<Question>(`/api/havuz/soru/${encodeURIComponent(id)}`);
}

export function havuzBankaGetir(id: string): Promise<BankaGonder> {
  return jsonIste<BankaGonder>(`/api/havuz/banka/${encodeURIComponent(id)}`);
}

export async function havuzSil(tur: "soru" | "banka", id: string): Promise<void> {
  await jsonIste(`/api/havuz/${tur}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function gonder(tur: "soru" | "banka", oge: unknown): Promise<void> {
  const j = await jsonIste<{ durum: string }>("/api/havuz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tur, oge }),
  });
  if (j.durum === "silinmis") {
    const liste = (await get<string[]>(REDDEDILEN)) ?? [];
    const id = (oge as { id: string }).id;
    if (!liste.includes(id)) await set(REDDEDILEN, [...liste, id]);
  }
}

/* Gönderimler sırayla gider; arayüzü bekletmez. Düşenleri bir sonraki eşitleme toplar. */
let kuyruk: Promise<unknown> = Promise.resolve();

function sirayaKoy(fn: () => Promise<void>): Promise<void> {
  const is = kuyruk.then(fn, fn);
  kuyruk = is.catch(() => undefined);
  return is;
}

export function havuzaSoruGonder(q: Question): Promise<void> {
  return sirayaKoy(() => gonder("soru", q)).catch((e) => console.warn("Havuz:", e));
}

export function havuzaBankaGonder(k: BankaGonder): Promise<void> {
  return sirayaKoy(() => gonder("banka", k));
}

/**
 * Bu tarayıcıda olup havuzda olmayan soruları ve föy bankası kayıtlarını gönderir.
 * Eski, yalnızca tarayıcıda duran soruların havuza taşınması da budur.
 */
export async function havuzEsitle(
  yereldeSorular: Question[],
  yereldeBanka: BankaGonder[]
): Promise<number> {
  const liste = await havuzListele();
  const reddedilen = new Set((await get<string[]>(REDDEDILEN)) ?? []);
  const varSoru = new Set(liste.sorular.map((s) => s.id));
  const varBanka = new Set(liste.banka.map((s) => s.id));
  let n = 0;
  for (const q of yereldeSorular) {
    if (varSoru.has(q.id) || reddedilen.has(q.id) || !q.imageDataUrl?.startsWith("data:image/")) continue;
    await sirayaKoy(() => gonder("soru", q)).then(
      () => n++,
      () => undefined
    );
  }
  for (const k of yereldeBanka) {
    if (varBanka.has(k.id) || reddedilen.has(k.id)) continue;
    await sirayaKoy(() => gonder("banka", k)).then(
      () => n++,
      () => undefined
    );
  }
  return n;
}
