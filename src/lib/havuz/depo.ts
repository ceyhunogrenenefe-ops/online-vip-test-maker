/**
 * Ortak soru havuzu deposu.
 *
 * Bütün öğretmenler aynı havuzu görür. Küçük bir dizin dosyası listeyi
 * taşır; görseller ve föy blokları her öğe için ayrı dosyadadır, böylece
 * liste açılırken yüzlerce görsel indirilmez.
 *
 * Vercel'de Blob (özel erişim), yerelde .data/havuz klasörü kullanılır.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export type Ekleyen = { id: string; ad: string };

export type SoruOzet = {
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

export type BankaOzet = {
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

export type HavuzDizin = {
  sorular: SoruOzet[];
  banka: BankaOzet[];
  /** Silinen öğeler, eski tarayıcılar yeniden yüklemesin diye tutulur. */
  silinen: string[];
};

export type Tur = "soru" | "banka";

const DIZIN = "havuz/dizin.json";

function ogeYolu(tur: Tur, id: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new HavuzHatasi("Geçersiz kimlik.", 400);
  return `havuz/${tur}/${id}.json`;
}

export class HavuzHatasi extends Error {
  durum: number;
  constructor(message: string, durum = 400) {
    super(message);
    this.durum = durum;
  }
}

function bos(): HavuzDizin {
  return { sorular: [], banka: [], silinen: [] };
}

function doldur(j: Partial<HavuzDizin>): HavuzDizin {
  return { sorular: j.sorular ?? [], banka: j.banka ?? [], silinen: j.silinen ?? [] };
}

function blobMu(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function kok(): string {
  return process.env.HAVUZ_YOL || join(process.cwd(), ".data");
}

function yerelMi(): void {
  if (!blobMu() && process.env.VERCEL) throw new HavuzHatasi("Soru havuzu deposu bağlı değil.", 503);
}

/* ------------------------------ ham okuma/yazma ------------------------------ */

function bulunamadi(e: unknown): boolean {
  const ad = e instanceof Error ? e.name : "";
  const mesaj = e instanceof Error ? e.message : String(e);
  return ad === "BlobNotFoundError" || /not found|does not exist/i.test(mesaj);
}

function cakisma(e: unknown): boolean {
  const ad = e instanceof Error ? e.name : "";
  const mesaj = e instanceof Error ? e.message : String(e);
  return ad === "BlobPreconditionFailedError" || /already exists|precondition failed/i.test(mesaj);
}

async function hamOku(yol: string): Promise<{ metin: string; etag: string | null } | null> {
  yerelMi();
  if (!blobMu()) {
    const p = join(kok(), yol);
    if (!existsSync(p)) return null;
    return { metin: readFileSync(p, "utf8"), etag: null };
  }
  const { get, head } = await import("@vercel/blob");
  let etag: string | null = null;
  try {
    etag = (await head(yol)).etag || null;
  } catch (e) {
    if (bulunamadi(e)) return null;
    throw e;
  }
  const indir = await get(yol, { access: "private", useCache: false });
  if (!indir || indir.statusCode !== 200 || !indir.stream) return null;
  return { metin: await new Response(indir.stream).text(), etag };
}

/** etag verilirse yalnızca dosya o sürümdeyse yazar; çakışmada false döner. */
async function hamYaz(yol: string, metin: string, etag?: string | null): Promise<boolean> {
  yerelMi();
  if (!blobMu()) {
    const p = join(kok(), yol);
    mkdirSync(dirname(p), { recursive: true });
    const gecici = `${p}.${process.pid}.tmp`;
    writeFileSync(gecici, metin);
    renameSync(gecici, p);
    return true;
  }
  const { put } = await import("@vercel/blob");
  const kosullu = etag !== undefined;
  try {
    await put(yol, metin, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: !kosullu || etag !== null,
      ifMatch: kosullu ? (etag ?? undefined) : undefined,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch (e) {
    if (kosullu && cakisma(e)) return false;
    throw e;
  }
}

async function hamSil(yol: string): Promise<void> {
  yerelMi();
  if (!blobMu()) {
    rmSync(join(kok(), yol), { force: true });
    return;
  }
  const { del } = await import("@vercel/blob");
  try {
    await del(yol);
  } catch (e) {
    if (!bulunamadi(e)) throw e;
  }
}

/* ---------------------------------- dizin ---------------------------------- */

export async function dizinOku(): Promise<HavuzDizin> {
  const ham = await hamOku(DIZIN);
  return ham ? doldur(JSON.parse(ham.metin) as Partial<HavuzDizin>) : bos();
}

let zincir: Promise<unknown> = Promise.resolve();

function sirayla<T>(fn: () => Promise<T>): Promise<T> {
  const is = zincir.then(fn, fn);
  zincir = is.then(
    () => undefined,
    () => undefined
  );
  return is;
}

/** Dizini okuyup değiştirir; başka biri araya girdiyse taze kopyaya yeniden uygular. */
export function dizinIsle<T>(fn: (d: HavuzDizin) => T): Promise<T> {
  return sirayla(async () => {
    for (let i = 0; i < 8; i++) {
      const ham = await hamOku(DIZIN);
      const d = ham ? doldur(JSON.parse(ham.metin) as Partial<HavuzDizin>) : bos();
      const sonuc = fn(d);
      if (await hamYaz(DIZIN, JSON.stringify(d), ham?.etag ?? null)) return sonuc;
    }
    throw new HavuzHatasi("Soru havuzu meşgul, tekrar deneyin.", 503);
  });
}

/* ---------------------------------- öğeler ---------------------------------- */

export async function ogeOku<T>(tur: Tur, id: string): Promise<T | null> {
  const ham = await hamOku(ogeYolu(tur, id));
  return ham ? (JSON.parse(ham.metin) as T) : null;
}

export async function ogeYaz(tur: Tur, id: string, veri: unknown): Promise<void> {
  await hamYaz(ogeYolu(tur, id), JSON.stringify(veri));
}

export async function ogeSil(tur: Tur, id: string): Promise<void> {
  await hamSil(ogeYolu(tur, id));
}
