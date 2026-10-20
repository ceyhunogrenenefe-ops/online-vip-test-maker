import paket from "../data/meb-ksdt-2026-2027.json" with { type: "json" };

export const MEB_KAYNAK = paket.kaynak;
export const MEB_YIL = paket.yil;

export type MebSatir = {
  ders: string;
  sinif: number;
  unite: string;
  konu: string;
  kazanim: string;
  kod: string;
  sinav1: number[];
  sinav2: number[];
};

const SATIRLAR = paket.satirlar as MebSatir[];

/** Karşılaştırma anahtarı. Türkçe harfler sadeleşir. */
export function mebNorm(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DERSLER: Record<string, string[]> = {
  matematik: ["ilkogretim matematik", "matematik"],
  turkce: ["turkce"],
  edebiyat: ["turk dili ve edebiyati"],
  "fen bilimleri": ["fen bilimleri"],
  fizik: ["fizik"],
  kimya: ["kimya"],
  biyoloji: ["biyoloji"],
  "sosyal bilgiler": ["sosyal bilgiler"],
  tarih: ["tarih"],
  cografya: ["cografya"],
  ingilizce: ["ingilizce"],
  "din kulturu ve ahlak bilgisi": ["din kulturu ve ahlak bilgisi"],
  felsefe: ["felsefe"],
};

export function sinifNo(sinif: number | string): number {
  const n = typeof sinif === "number" ? sinif : Number(String(sinif).match(/\d+/)?.[0] || 0);
  return n >= 1 && n <= 12 ? n : 0;
}

function hedefler(brans: string): string[] {
  const n = mebNorm(brans);
  if (!n || n === "geometri") return [];
  if (DERSLER[n]) return DERSLER[n];
  if (n.includes("inkilap") || n.includes("ataturk")) return ["sosyal bilgiler", "tarih"];
  const bulunan = Object.keys(DERSLER).filter((k) => k.length > 4 && (n.includes(k) || k.includes(n)));
  return [...new Set(bulunan.flatMap((k) => DERSLER[k]))];
}

/** ODSGM 2026-2027 1. dönem tablosundan, sınıf ve derse ait satırlar. */
export function mebKazanimlari(sinif: number | string, brans: string): MebSatir[] {
  const no = sinifNo(sinif);
  const adlar = hedefler(brans);
  if (!no || !adlar.length) return [];
  const inkilap = mebNorm(brans).includes("inkilap") || mebNorm(brans).includes("ataturk");
  return SATIRLAR.filter((s) => {
    if (s.sinif !== no || !adlar.includes(mebNorm(s.ders))) return false;
    if (!inkilap) return true;
    return (no === 8 && mebNorm(s.ders) === "sosyal bilgiler") || (no === 12 && mebNorm(s.ders) === "tarih");
  });
}

/**
 * Metin, seçilen sınıf ve dersin resmî satırıyla birebir ya da koduyla
 * eşleşirse o satır döner. Yakın anlamlı serbest metin eşleşme sayılmaz.
 */
export function mebKazanimBul(sinif: number | string, brans: string, metin: string): MebSatir | null {
  const q = metin.trim();
  if (!q) return null;
  const liste = mebKazanimlari(sinif, brans);
  const kod = q.split(/\s+/)[0].replace(/\.$/, "");
  return (
    liste.find((s) => s.kazanim === q) ||
    liste.find((s) => s.kod && (s.kod === q || s.kod === kod)) ||
    null
  );
}
