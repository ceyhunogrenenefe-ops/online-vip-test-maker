/**
 * Deneme formatları. Her test kendi içinde 1'den numaralanır; testin
 * alt dersleri (TYT Sosyal: Tarih 1–5, Coğrafya 6–10 …) sırayla gelir.
 * Soru sayıları deneme kurarken değiştirilebilir.
 */

import { norm } from "./turkce.ts";

export type FormatDers = { ad: string; adet: number };

export type FormatTest = {
  ad: string;
  /** PDF'te test başlığını tanımak için normalize edilmiş adlar. */
  adlar: string[];
  dersler: FormatDers[];
};

export type FormatOturum = { ad: string; sureDakika: number; testler: FormatTest[] };

export type SinavFormati = {
  id: string;
  ad: string;
  sikSayisi: 4 | 5;
  ceza: number;
  oturumlar: FormatOturum[];
};

const t = (ad: string, adlar: string[], dersler: FormatDers[]): FormatTest => ({ ad, adlar, dersler });
const tek = (ad: string, adet: number, adlar: string[]): FormatTest => t(ad, adlar, [{ ad, adet }]);

const TURKCE = ["turkce"];
const MAT = ["matematik", "temel matematik"];
const FEN = ["fen bilimleri", "fen ve teknoloji", "fen"];
const DIN = ["din kulturu", "din kulturu ve ahlak bilgisi", "din"];
const ING = ["ingilizce", "yabanci dil", "english"];

function ortaokul(id: string, ad: string, sosyal: FormatTest): SinavFormati {
  return {
    id,
    ad,
    sikSayisi: 4,
    ceza: 1 / 3,
    oturumlar: [
      {
        ad: "Sözel Bölüm",
        sureDakika: 75,
        testler: [
          tek("Türkçe", 20, TURKCE),
          sosyal,
          tek("Din Kültürü ve Ahlak Bilgisi", 10, DIN),
          tek("İngilizce", 10, ING),
        ],
      },
      {
        ad: "Sayısal Bölüm",
        sureDakika: 80,
        testler: [tek("Matematik", 20, MAT), tek("Fen Bilimleri", 20, FEN)],
      },
    ],
  };
}

function tytTipi(id: string, ad: string): SinavFormati {
  return {
    id,
    ad,
    sikSayisi: 5,
    ceza: 1 / 4,
    oturumlar: [
      {
        ad: "TYT",
        sureDakika: 165,
        testler: [
          tek("Türkçe", 40, TURKCE),
          t("Sosyal Bilimler", ["sosyal bilimler", "sosyal"], [
            { ad: "Tarih", adet: 5 },
            { ad: "Coğrafya", adet: 5 },
            { ad: "Felsefe", adet: 5 },
            { ad: "Din Kültürü", adet: 5 },
          ]),
          tek("Temel Matematik", 40, MAT),
          t("Fen Bilimleri", FEN, [
            { ad: "Fizik", adet: 7 },
            { ad: "Kimya", adet: 7 },
            { ad: "Biyoloji", adet: 6 },
          ]),
        ],
      },
    ],
  };
}

const SOSYAL_BILGILER = tek("Sosyal Bilgiler", 10, ["sosyal bilgiler", "sosyal"]);

export const FORMATLAR: SinavFormati[] = [
  ortaokul("5", "5. Sınıf", SOSYAL_BILGILER),
  ortaokul("6", "6. Sınıf", SOSYAL_BILGILER),
  ortaokul("7", "7. Sınıf", SOSYAL_BILGILER),
  ortaokul(
    "LGS",
    "LGS (8. Sınıf)",
    tek("T.C. İnkılap Tarihi ve Atatürkçülük", 10, ["inkilap tarihi", "inkilap", "ataturkculuk", "tc inkilap"])
  ),
  tytTipi("9", "9. Sınıf"),
  tytTipi("10", "10. Sınıf"),
  tytTipi("11", "11. Sınıf"),
  tytTipi("TYT", "TYT"),
  {
    id: "AYT",
    ad: "AYT",
    sikSayisi: 5,
    ceza: 1 / 4,
    oturumlar: [
      {
        ad: "AYT",
        sureDakika: 180,
        testler: [
          t("Türk Dili ve Edebiyatı-Sosyal Bilimler-1", ["edebiyat", "sosyal bilimler 1", "sosyal bilimler-1"], [
            { ad: "Türk Dili ve Edebiyatı", adet: 24 },
            { ad: "Tarih-1", adet: 10 },
            { ad: "Coğrafya-1", adet: 6 },
          ]),
          t("Sosyal Bilimler-2", ["sosyal bilimler 2", "sosyal bilimler-2"], [
            { ad: "Tarih-2", adet: 11 },
            { ad: "Coğrafya-2", adet: 11 },
            { ad: "Felsefe Grubu", adet: 12 },
            { ad: "Din Kültürü", adet: 6 },
          ]),
          tek("Matematik", 40, ["matematik"]),
          t("Fen Bilimleri", ["fen bilimleri", "fen"], [
            { ad: "Fizik", adet: 14 },
            { ad: "Kimya", adet: 13 },
            { ad: "Biyoloji", adet: 13 },
          ]),
        ],
      },
    ],
  },
];

export function formatBul(id: string): SinavFormati {
  return FORMATLAR.find((f) => f.id === id) ?? FORMATLAR[3];
}

export function tumTestler(f: SinavFormati): FormatTest[] {
  return f.oturumlar.flatMap((o) => o.testler);
}

export function testAdet(test: FormatTest): number {
  return test.dersler.reduce((t, d) => t + d.adet, 0);
}

/** Test içindeki numaradan alt dersi bulur (TYT Sosyal 7 → Coğrafya). */
export function numaradanDers(test: FormatTest, numara: number | null): string {
  if (!numara || numara < 1) return test.dersler[0].ad;
  let son = 0;
  for (const d of test.dersler) {
    son += d.adet;
    if (numara <= son) return d.ad;
  }
  return test.dersler[test.dersler.length - 1].ad;
}

/**
 * Kısa, büyük harfli bir satır test başlığıysa testin sırasını döner.
 * En uzun eşleşen ad kazanır ("sosyal bilimler 2" > "sosyal").
 */
export function baslikTesti(metin: string, testler: FormatTest[]): number | null {
  const ham = metin.trim();
  if (!ham || ham.length > 70 || /^\d/.test(ham)) return null;
  const harf = ham.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  if (harf.length < 3) return null;
  const buyuk = harf.replace(/[^A-ZÇĞİÖŞÜ]/g, "").length / harf.length;
  if (buyuk < 0.6) return null;
  const n = norm(ham).replace(/[-–]/g, " ").replace(/\s+/g, " ");
  if (/bu testte|soru vardir|cevap anahtari/.test(n)) return null;
  let en: { i: number; uzunluk: number } | null = null;
  testler.forEach((test, i) => {
    for (const ad of test.adlar) {
      const a = ad.replace(/[-–]/g, " ");
      const sinir = new RegExp(`(^|\\s)${a.replace(/\s+/g, "\\s+")}(\\s|$)`);
      if (sinir.test(n) && (!en || a.length > en.uzunluk)) en = { i, uzunluk: a.length };
    }
  });
  return en ? (en as { i: number }).i : null;
}
