/**
 * "Online Testlerim" deposu.
 *
 * Eskiden test yalnızca öğretmenin tarayıcısında (IndexedDB) duruyordu; öğrenci
 * linki kendi cihazında açınca test bulunamıyordu. Artık test, görselleri ve
 * teslimler sunucuda tutulur:
 *   online/test/<id>.json            test (görsel yolları, cevap anahtarı)
 *   online/gorsel/<id>/<n>           soru görseli (ham bayt)
 *   online/teslim/<id>/<zaman>-<r>.json  her teslim ayrı dosya (çakışma yok)
 *
 * Vercel'de Blob (özel erişim), yerelde .data/online klasörü kullanılır.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export class OnlineHatasi extends Error {
  durum: number;
  constructor(message: string, durum = 400) {
    super(message);
    this.durum = durum;
  }
}

function blobMu(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function kok(): string {
  return process.env.ONLINE_YOL || join(process.cwd(), ".data");
}

function hazirMi(): void {
  if (!blobMu() && process.env.VERCEL) throw new OnlineHatasi("Kalıcı sınav deposu bağlı değil.", 503);
}

function bulunamadi(e: unknown): boolean {
  const ad = e instanceof Error ? e.name : "";
  const mesaj = e instanceof Error ? e.message : String(e);
  return ad === "BlobNotFoundError" || /not found|does not exist/i.test(mesaj);
}

export async function bayOku(yol: string): Promise<{ veri: Uint8Array; tur: string } | null> {
  hazirMi();
  if (!blobMu()) {
    const p = join(kok(), yol);
    if (!existsSync(p)) return null;
    const turYol = `${p}.tur`;
    return {
      veri: new Uint8Array(readFileSync(p)),
      tur: existsSync(turYol) ? readFileSync(turYol, "utf8") : "application/octet-stream",
    };
  }
  const { get } = await import("@vercel/blob");
  try {
    const r = await get(yol, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return {
      veri: new Uint8Array(await new Response(r.stream).arrayBuffer()),
      tur: r.blob?.contentType || "application/octet-stream",
    };
  } catch (e) {
    if (bulunamadi(e)) return null;
    throw e;
  }
}

export async function bayYaz(yol: string, veri: Uint8Array | string, tur: string): Promise<void> {
  hazirMi();
  if (!blobMu()) {
    const p = join(kok(), yol);
    mkdirSync(dirname(p), { recursive: true });
    const gecici = `${p}.${process.pid}.tmp`;
    writeFileSync(gecici, veri);
    renameSync(gecici, p);
    writeFileSync(`${p}.tur`, tur);
    return;
  }
  const { put } = await import("@vercel/blob");
  await put(yol, typeof veri === "string" ? veri : Buffer.from(veri), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: tur,
    cacheControlMaxAge: 60,
  });
}

export async function jsonOku<T>(yol: string): Promise<T | null> {
  const r = await bayOku(yol);
  return r ? (JSON.parse(Buffer.from(r.veri).toString("utf8")) as T) : null;
}

export async function jsonYaz(yol: string, veri: unknown): Promise<void> {
  await bayYaz(yol, JSON.stringify(veri), "application/json");
}

/** Klasördeki dosya yolları (blob önekine göre). */
export async function listele(onek: string): Promise<string[]> {
  hazirMi();
  if (!blobMu()) {
    const p = join(kok(), onek);
    if (!existsSync(p)) return [];
    return readdirSync(p)
      .filter((a) => !a.endsWith(".tur") && !a.endsWith(".tmp"))
      .map((a) => `${onek.replace(/\/$/, "")}/${a}`);
  }
  const { list } = await import("@vercel/blob");
  const yollar: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: onek, cursor, limit: 1000 });
    yollar.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return yollar;
}

export async function onekSil(onek: string): Promise<void> {
  hazirMi();
  if (!blobMu()) {
    rmSync(join(kok(), onek), { recursive: true, force: true });
    return;
  }
  const yollar = await listele(onek);
  if (!yollar.length) return;
  const { del } = await import("@vercel/blob");
  await del(yollar);
}

export async function dosyaSil(yol: string): Promise<void> {
  hazirMi();
  if (!blobMu()) {
    rmSync(join(kok(), yol), { force: true });
    rmSync(join(kok(), `${yol}.tur`), { force: true });
    return;
  }
  const { del } = await import("@vercel/blob");
  try {
    await del(yol);
  } catch (e) {
    if (!bulunamadi(e)) throw e;
  }
}
