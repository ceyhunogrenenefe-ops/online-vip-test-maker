/**
 * Föy künyesi — kapak başlığını seçimlerden üretir.
 *
 * Yalnızca Föy Oluştur bu modeli kullanır. Diğer sınav ekranlarının
 * PaperSettings alanlarına dokunulmaz; kapak satırları oraya sonradan
 * eşlenir.
 */

export const FOY_TURLERI = [
  "Yazılıya Hazırlık",
  "Konu Tekrar Föyü",
  "Kazanım Pekiştirme",
  "Soru Çözüm Föyü",
  "Yazılı Provası",
  "Cevap Anahtarlı Öğretmen Föyü",
] as const;

export type FoyTuru = (typeof FOY_TURLERI)[number];

export const DONEMLER = ["1. Dönem", "2. Dönem"] as const;
export type Donem = (typeof DONEMLER)[number];

export const YAZILILAR = ["1. Yazılı", "2. Yazılı", "3. Yazılı"] as const;
export type YaziliNo = (typeof YAZILILAR)[number];

export const SINIFLAR = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const BRANS_ONERILERI = [
  "Matematik",
  "Geometri",
  "Türkçe",
  "Edebiyat",
  "Fen Bilimleri",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Sosyal Bilgiler",
  "Tarih",
  "Coğrafya",
  "İngilizce",
  "Din Kültürü ve Ahlak Bilgisi",
] as const;

export type FoyKunye = {
  dokumanAdi: string;
  brans: string;
  sinif: number;
  egitimYili: string;
  donem: Donem;
  yazili: YaziliNo;
  tur: FoyTuru;
  konu: string;
  ogretmen: string;
  website: string;
};

export type FoyTasarim = {
  yon: "portrait" | "landscape";
  sutun: 1 | 2;
  kenarMm: number;
  soruAraligiMm: number;
  cozum: "yok" | "cizgili" | "kareli" | "bos";
  cozumSatir: number;
  filigran: boolean;
  /** Kurum logosu varsa filigran olarak kullanılır. Logo yoksa metin filigrana düşülür. */
  filigranLogo: boolean;
};

/** Türkiye'de öğretim yılı Eylül'de değişir. */
export function egitimYiliBaslangic(tarih: Date): number {
  const ay = tarih.getMonth();
  const yil = tarih.getFullYear();
  return ay >= 8 ? yil : yil - 1;
}

/**
 * Açılır menü: 2025–2026'dan başlar, içinde bulunulan yıl ve sonraki
 * yıllar otomatik eklenir.
 */
export function egitimYillari(tarih = new Date(), ileri = 3): string[] {
  const bas = Math.min(2025, egitimYiliBaslangic(tarih));
  const son = egitimYiliBaslangic(tarih) + Math.max(0, ileri);
  const liste: string[] = [];
  for (let y = bas; y <= son; y++) liste.push(`${y}–${y + 1}`);
  return liste;
}

export function varsayilanEgitimYili(tarih = new Date()): string {
  const y = egitimYiliBaslangic(tarih);
  return `${y}–${y + 1}`;
}

export function varsayilanKunye(tarih = new Date()): FoyKunye {
  return {
    dokumanAdi: "",
    brans: "Matematik",
    sinif: 7,
    egitimYili: varsayilanEgitimYili(tarih),
    donem: "1. Dönem",
    yazili: "1. Yazılı",
    tur: "Yazılıya Hazırlık",
    konu: "",
    ogretmen: "",
    website: "",
  };
}

export function varsayilanTasarim(): FoyTasarim {
  return {
    yon: "portrait",
    sutun: 2,
    kenarMm: 12,
    soruAraligiMm: 0,
    cozum: "yok",
    cozumSatir: 4,
    filigran: true,
    filigranLogo: false,
  };
}

function yaziliSira(yazili: string): string {
  const m = yazili.match(/^(\d+)/);
  return m ? `${m[1]}.` : yazili;
}

/** Kapaktaki dördüncü satır: dönemden sonraki föy adı. */
export function foyTurSatiri(k: Pick<FoyKunye, "tur" | "yazili">): string {
  const n = yaziliSira(k.yazili);
  switch (k.tur) {
    case "Yazılıya Hazırlık":
      return `${n} YAZILIYA HAZIRLIK FÖYÜ`;
    case "Konu Tekrar Föyü":
      return "KONU TEKRAR FÖYÜ";
    case "Kazanım Pekiştirme":
      return "KAZANIM PEKİŞTİRME FÖYÜ";
    case "Soru Çözüm Föyü":
      return "SORU ÇÖZÜM FÖYÜ";
    case "Yazılı Provası":
      return `${n} YAZILI PROVASI`;
    case "Cevap Anahtarlı Öğretmen Föyü":
      return `${n} YAZILI ÖĞRETMEN FÖYÜ`;
  }
}

export type KapakSatirlari = [string, string, string, string];

/** Örnek: ONLINE VIP DERSHANE / 2026–2027 EĞİTİM ÖĞRETİM YILI / 7. SINIF MATEMATİK / 1. DÖNEM 1. YAZILIYA HAZIRLIK FÖYÜ */
export function kapakSatirlari(k: FoyKunye): KapakSatirlari {
  const brans = (k.brans || "DERS").trim().toLocaleUpperCase("tr-TR");
  const sinif = Math.min(12, Math.max(3, Math.round(k.sinif) || 3));
  const donem = (k.donem || "1. Dönem").toLocaleUpperCase("tr-TR");
  return [
    "ONLINE VIP DERSHANE",
    `${k.egitimYili} EĞİTİM ÖĞRETİM YILI`,
    `${sinif}. SINIF ${brans}`,
    `${donem} ${foyTurSatiri(k)}`,
  ];
}

export function kapakMetni(k: FoyKunye): string {
  return kapakSatirlari(k).join("\n");
}

const TUR_KUMESI = new Set<string>(FOY_TURLERI);

/** Eski serbest metin künyesini seçmeli modele taşır. Kayıtlı taslak bozulmaz. */
export function kunyeEskiden(
  ham: {
    sinif?: string;
    brans?: string;
    konu?: string;
    tur?: string;
    dokumanAdi?: string;
    egitimYili?: string;
    donem?: string;
    yazili?: string;
    ogretmen?: string;
    website?: string;
    sinifNo?: number;
  } | null
  | undefined,
  tarih = new Date()
): FoyKunye {
  const taban = varsayilanKunye(tarih);
  if (!ham) return taban;
  const sinifMetin = String(ham.sinifNo ?? ham.sinif ?? "");
  const sinifEslesme = sinifMetin.match(/(\d{1,2})/);
  const sinif = sinifEslesme ? Number(sinifEslesme[1]) : taban.sinif;
  const turHam = (ham.tur || "").trim();
  const tur = (TUR_KUMESI.has(turHam) ? turHam : taban.tur) as FoyTuru;
  const donem = DONEMLER.includes(ham.donem as Donem) ? (ham.donem as Donem) : taban.donem;
  const yazili = YAZILILAR.includes(ham.yazili as YaziliNo)
    ? (ham.yazili as YaziliNo)
    : taban.yazili;
  const yillar = egitimYillari(tarih);
  const egitimYili =
    ham.egitimYili && yillar.includes(ham.egitimYili) ? ham.egitimYili : taban.egitimYili;
  return {
    dokumanAdi: ham.dokumanAdi || "",
    brans: (ham.brans || taban.brans).replace(/\s+/g, " ").trim() || taban.brans,
    sinif: sinif >= 3 && sinif <= 12 ? sinif : taban.sinif,
    egitimYili,
    donem,
    yazili,
    tur,
    konu: ham.konu || "",
    ogretmen: ham.ogretmen || "",
    website: ham.website || "",
  };
}

export function yeniId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}
