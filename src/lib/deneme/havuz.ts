"use client";

/**
 * Soru havuzu tarayıcıda (IndexedDB) tutulur: yüzlerce soru görseli sunucuya
 * gitmeden kesilir, düzeltilir ve denemeye seçilir. Yalnızca online
 * yayımlanan denemenin soruları sunucuya yüklenir.
 */

import { createStore, del, delMany, get, getMany, set, setMany } from "idb-keyval";
import type { Kutu, Sik } from "./model";

export type HavuzPdf = {
  id: string;
  ad: string;
  formatId: string;
  /** Tek ders PDF'iyse formatın test sırası; deneme PDF'iyse null. */
  tekTest: number | null;
  sayfaSayisi: number;
  /** Her sayfanın punto boyutu ve görsel ölçeği. */
  sayfalar: { genislik: number; yukseklik: number; olcek: number; ocr: boolean }[];
  yukleme: number;
  anahtarBulunan: number;
};

export type HavuzSoru = {
  id: string;
  pdfId: string;
  formatId: string;
  test: string;
  ders: string;
  numara: number | null;
  dogru: Sik | null;
  sayfa: number;
  kutu: Kutu;
  noKutu: Kutu | null;
  grupId: string | null;
  kullanim: number;
  /** Görsel en son ne zaman kesildi; önbellek kırmak için. */
  surum: number;
};

export type HavuzGrup = { id: string; pdfId: string; parcalar: { sayfa: number; kutu: Kutu }[]; surum: number };

export type DenemeTaslak = {
  id: string;
  ad: string;
  formatId: string;
  ceza: number;
  sikSayisi: 4 | 5;
  oturumlar: { ad: string; sureDakika: number; testler: { ad: string; dersler: { ad: string; adet: number }[] }[] }[];
  /** "Test|Ders" → sıralı soru id'leri */
  secim: Record<string, string[]>;
  olusturma: number;
  yayin: { id: string; kod: string } | null;
};

const depo = typeof indexedDB === "undefined" ? undefined : createStore("deneme-studyo", "kv");

export async function pdfleriOku(): Promise<HavuzPdf[]> {
  return (await get<HavuzPdf[]>("pdfler", depo)) ?? [];
}
export async function sorulariOku(): Promise<HavuzSoru[]> {
  return (await get<HavuzSoru[]>("sorular", depo)) ?? [];
}
export async function gruplariOku(): Promise<HavuzGrup[]> {
  return (await get<HavuzGrup[]>("gruplar", depo)) ?? [];
}
export async function denemeleriOku(): Promise<DenemeTaslak[]> {
  return (await get<DenemeTaslak[]>("denemeler", depo)) ?? [];
}

export async function sorulariYaz(sorular: HavuzSoru[]) {
  await set("sorular", sorular, depo);
}
export async function gruplariYaz(gruplar: HavuzGrup[]) {
  await set("gruplar", gruplar, depo);
}
export async function pdfleriYaz(pdfler: HavuzPdf[]) {
  await set("pdfler", pdfler, depo);
}
export async function denemeleriYaz(d: DenemeTaslak[]) {
  await set("denemeler", d, depo);
}

export const gorselAnahtar = (id: string) => `img:${id}`;
export const sayfaAnahtar = (pdfId: string, sayfa: number) => `sayfa:${pdfId}:${sayfa}`;

export async function gorselOku(id: string): Promise<Blob | undefined> {
  return get<Blob>(gorselAnahtar(id), depo);
}
export async function gorselleriYaz(liste: [string, Blob][]) {
  await setMany(liste.map(([id, b]) => [gorselAnahtar(id), b]), depo);
}
export async function sayfaOku(pdfId: string, sayfa: number): Promise<Blob | undefined> {
  return get<Blob>(sayfaAnahtar(pdfId, sayfa), depo);
}
export async function sayfalariYaz(pdfId: string, liste: Blob[]) {
  await setMany(liste.map((b, i) => [sayfaAnahtar(pdfId, i + 1), b]), depo);
}
export async function sayfalariOku(pdfId: string, adet: number): Promise<(Blob | undefined)[]> {
  return getMany(Array.from({ length: adet }, (_, i) => sayfaAnahtar(pdfId, i + 1)), depo);
}

export async function pdfSil(pdf: HavuzPdf) {
  const sorular = await sorulariOku();
  const gruplar = await gruplariOku();
  const silinen = sorular.filter((s) => s.pdfId === pdf.id);
  const grupSil = gruplar.filter((g) => g.pdfId === pdf.id);
  await delMany(
    [
      ...silinen.map((s) => gorselAnahtar(s.id)),
      ...grupSil.map((g) => gorselAnahtar(g.id)),
      ...Array.from({ length: pdf.sayfaSayisi }, (_, i) => sayfaAnahtar(pdf.id, i + 1)),
    ],
    depo
  );
  await sorulariYaz(sorular.filter((s) => s.pdfId !== pdf.id));
  await gruplariYaz(gruplar.filter((g) => g.pdfId !== pdf.id));
  await pdfleriYaz((await pdfleriOku()).filter((p) => p.id !== pdf.id));
}

export async function gorselSil(id: string) {
  await del(gorselAnahtar(id), depo);
}
