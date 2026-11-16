import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import type { Deneme, Oturum, PdfKayit, Soru } from "./model";

export type DepoDosya = {
  pdfler: PdfKayit[];
  sorular: Soru[];
  denemeler: Deneme[];
  oturumlar: Oturum[];
};

const BLOB_YOL = "deneme/depo.json";

function yol(): string {
  return process.env.DENEME_DEPO_YOL || join(process.cwd(), ".data", "deneme.json");
}

function bos(): DepoDosya {
  return { pdfler: [], sorular: [], denemeler: [], oturumlar: [] };
}

function doldur(json: DepoDosya): DepoDosya {
  return {
    pdfler: json.pdfler ?? [],
    sorular: json.sorular ?? [],
    denemeler: json.denemeler ?? [],
    oturumlar: json.oturumlar ?? [],
  };
}

function blobMu(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function dosyaOku(): DepoDosya {
  const p = yol();
  if (!existsSync(p)) return bos();
  try {
    return doldur(JSON.parse(readFileSync(p, "utf8")) as DepoDosya);
  } catch {
    return bos();
  }
}

function dosyaYaz(depo: DepoDosya) {
  const p = yol();
  mkdirSync(dirname(p), { recursive: true });
  const gecici = `${p}.${process.pid}.tmp`;
  writeFileSync(gecici, JSON.stringify(depo));
  renameSync(gecici, p);
}

function cakisma(e: unknown): boolean {
  const ad = e instanceof Error ? e.name : "";
  const mesaj = e instanceof Error ? e.message : String(e);
  return ad === "BlobPreconditionFailedError" || /already exists|precondition failed/i.test(mesaj);
}

async function blobOku(): Promise<{ depo: DepoDosya; etag: string | null }> {
  const { get } = await import("@vercel/blob");
  try {
    const indir = await get(BLOB_YOL, { access: "private", useCache: false });
    if (!indir || indir.statusCode !== 200 || !indir.stream) return { depo: bos(), etag: null };
    const metin = await new Response(indir.stream).text();
    return { depo: doldur(JSON.parse(metin) as DepoDosya), etag: indir.blob.etag };
  } catch (e) {
    const ad = e instanceof Error ? e.name : "";
    const mesaj = e instanceof Error ? e.message : String(e);
    if (ad === "BlobNotFoundError" || /not found|does not exist/i.test(mesaj)) {
      return { depo: bos(), etag: null };
    }
    throw e;
  }
}

async function blobYaz(depo: DepoDosya, etag: string | null): Promise<boolean> {
  const { put } = await import("@vercel/blob");
  try {
    await put(BLOB_YOL, JSON.stringify(depo), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: etag !== null,
      ifMatch: etag ?? undefined,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch (e) {
    if (cakisma(e)) return false;
    throw e;
  }
}

export async function depoOku(): Promise<DepoDosya> {
  if (blobMu()) return (await blobOku()).depo;
  if (process.env.VERCEL) throw new Error("Kalıcı sınav deposu bağlı değil.");
  return dosyaOku();
}

let zincir: Promise<unknown> = Promise.resolve();

function sirayla<T>(fn: () => Promise<T> | T): Promise<T> {
  const is = zincir.then(fn, fn);
  zincir = is.then(
    () => undefined,
    () => undefined
  );
  return is;
}

/**
 * Okuyup değiştirir. Dosyada tek süreç sıraya girer.
 * Blob’da sürüm çakışırsa işlem taze kopyaya yeniden uygulanır;
 * böylece ikinci teslim yeni sonuç ve ikinci SMS açmaz.
 */
export function depoIsle<T>(fn: (depo: DepoDosya) => T): Promise<T> {
  if (!blobMu()) {
    if (process.env.VERCEL) return Promise.reject(new Error("Kalıcı sınav deposu bağlı değil."));
    return sirayla(() => {
      const depo = dosyaOku();
      const sonuc = fn(depo);
      dosyaYaz(depo);
      return sonuc;
    });
  }
  return sirayla(async () => {
    let son: unknown;
    for (let i = 0; i < 8; i++) {
      const { etag, depo } = await blobOku();
      const kopya = structuredClone(depo);
      const sonuc = fn(kopya);
      if (await blobYaz(kopya, etag)) return sonuc;
      son = new Error("Sınav deposu meşgul.");
    }
    throw son;
  });
}
