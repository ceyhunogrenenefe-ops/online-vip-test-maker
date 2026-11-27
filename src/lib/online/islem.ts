import { randomUUID } from "crypto";
import {
  OnlineHatasi,
  bayOku,
  bayYaz,
  dosyaSil,
  jsonOku,
  jsonYaz,
  listele,
  onekSil,
} from "./depo.ts";

export { OnlineHatasi };

const SIKLAR = ["A", "B", "C", "D", "E"] as const;
type Sik = (typeof SIKLAR)[number];

export type SunucuTest = {
  id: string;
  title: string;
  schoolName: string;
  durationMinutes?: number;
  createdAt: number;
  /** Soru sırası; her biri için cevap anahtarı (yoksa null). */
  sorular: { id: string; answerKey: Sik | null }[];
};

export type Teslim = {
  studentName: string;
  answers: Record<number, Sik>;
  submittedAt: number;
  score: number;
  total: number;
};

const GORSEL_YOL = "/api/online/sinav/gorsel";
const EN_FAZLA_SORU = 300;
const EN_BUYUK_GORSEL = 4_000_000;

export function idTemiz(id: unknown): string {
  const s = typeof id === "string" ? id.trim() : "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(s)) throw new OnlineHatasi("Geçersiz test kimliği.", 400);
  return s;
}

function sikMi(v: unknown): v is Sik {
  return typeof v === "string" && (SIKLAR as readonly string[]).includes(v);
}

const testYolu = (id: string) => `online/test/${id}.json`;
const gorselYolu = (id: string, n: number) => `online/gorsel/${id}/${n}`;

/** Bir sorunun görselini yükler (data URL). Yayınlamadan önce her soru için çağrılır. */
export async function gorselYukle(idHam: unknown, nHam: unknown, veriHam: unknown) {
  const id = idTemiz(idHam);
  const n = Number(nHam);
  if (!Number.isInteger(n) || n < 0 || n >= EN_FAZLA_SORU) throw new OnlineHatasi("Geçersiz soru sırası.");
  const m = typeof veriHam === "string" ? veriHam.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/) : null;
  if (!m) throw new OnlineHatasi("Soru görseli okunamadı.");
  const veri = Buffer.from(m[2], "base64");
  if (veri.length > EN_BUYUK_GORSEL) throw new OnlineHatasi("Soru görseli çok büyük.");
  await bayYaz(gorselYolu(id, n), new Uint8Array(veri), m[1]);
  return { tamam: true };
}

/** Testi (görseller yüklendikten sonra) kaydeder. Aynı id ile tekrar çağrılırsa günceller. */
export async function testYayinla(girdi: {
  id?: unknown;
  title?: unknown;
  schoolName?: unknown;
  durationMinutes?: unknown;
  createdAt?: unknown;
  sorular?: unknown;
}) {
  const id = idTemiz(girdi.id);
  const ham = Array.isArray(girdi.sorular) ? girdi.sorular : [];
  if (!ham.length) throw new OnlineHatasi("Testte soru yok.");
  if (ham.length > EN_FAZLA_SORU) throw new OnlineHatasi("Testte çok fazla soru var.");
  const sorular = ham.map((s, i) => {
    const o = (s ?? {}) as { id?: unknown; answerKey?: unknown };
    return {
      id: typeof o.id === "string" && o.id ? o.id.slice(0, 80) : `s${i + 1}`,
      answerKey: sikMi(o.answerKey) ? o.answerKey : null,
    };
  });
  const sure = Number(girdi.durationMinutes);
  const test: SunucuTest = {
    id,
    title: String(girdi.title ?? "").trim().slice(0, 200) || "Online Test",
    schoolName: String(girdi.schoolName ?? "").trim().slice(0, 200) || "Dershanem",
    durationMinutes: Number.isFinite(sure) && sure > 0 && sure <= 600 ? Math.round(sure) : undefined,
    createdAt: Number(girdi.createdAt) || Date.now(),
    sorular,
  };
  await jsonYaz(testYolu(id), test);
  return { id };
}

export async function testVarMi(idHam: unknown): Promise<boolean> {
  return (await jsonOku<SunucuTest>(testYolu(idTemiz(idHam)))) !== null;
}

/** Öğrenciye giden görünüm: cevap anahtarı yok. */
export async function ogrenciTesti(idHam: unknown) {
  const id = idTemiz(idHam);
  const test = await jsonOku<SunucuTest>(testYolu(id));
  if (!test) throw new OnlineHatasi("Sınav bulunamadı.", 404);
  return {
    id: test.id,
    title: test.title,
    schoolName: test.schoolName,
    durationMinutes: test.durationMinutes,
    sorular: test.sorular.map((s, i) => ({
      id: s.id,
      gorsel: `${GORSEL_YOL}?id=${encodeURIComponent(id)}&n=${i}`,
    })),
  };
}

export async function soruGorseli(idHam: unknown, nHam: unknown) {
  const id = idTemiz(idHam);
  const n = Number(nHam);
  if (!Number.isInteger(n) || n < 0) return null;
  return bayOku(gorselYolu(id, n));
}

export function puanla(sorular: SunucuTest["sorular"], cevaplar: Record<number, Sik>) {
  let score = 0;
  let total = 0;
  sorular.forEach((s, i) => {
    if (!s.answerKey) return;
    total++;
    if (cevaplar[i] === s.answerKey) score++;
  });
  return { score, total };
}

export async function teslimEt(girdi: { id?: unknown; studentName?: unknown; answers?: unknown }) {
  const id = idTemiz(girdi.id);
  const test = await jsonOku<SunucuTest>(testYolu(id));
  if (!test) throw new OnlineHatasi("Sınav bulunamadı.", 404);
  const ad = typeof girdi.studentName === "string" ? girdi.studentName.replace(/\s+/g, " ").trim() : "";
  if (ad.length < 2) throw new OnlineHatasi("Ad soyad girin.");
  const cevaplar: Record<number, Sik> = {};
  if (girdi.answers && typeof girdi.answers === "object") {
    for (const [k, v] of Object.entries(girdi.answers as Record<string, unknown>)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < test.sorular.length && sikMi(v)) cevaplar[i] = v;
    }
  }
  const { score, total } = puanla(test.sorular, cevaplar);
  const teslim: Teslim = { studentName: ad.slice(0, 120), answers: cevaplar, submittedAt: Date.now(), score, total };
  await jsonYaz(`online/teslim/${id}/${teslim.submittedAt}-${randomUUID().slice(0, 8)}.json`, teslim);
  return { score, total };
}

export async function teslimler(idHam: unknown): Promise<Teslim[]> {
  const id = idTemiz(idHam);
  const yollar = await listele(`online/teslim/${id}/`);
  const liste = await Promise.all(yollar.map((y) => jsonOku<Teslim>(y).catch(() => null)));
  return liste.filter((t): t is Teslim => !!t).sort((a, b) => b.submittedAt - a.submittedAt);
}

export async function testSil(idHam: unknown) {
  const id = idTemiz(idHam);
  await dosyaSil(testYolu(id));
  await onekSil(`online/gorsel/${id}/`);
  await onekSil(`online/teslim/${id}/`);
  return { tamam: true };
}
