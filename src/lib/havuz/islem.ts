/**
 * Ortak havuz işlemleri. Herkes her şeyi görür;
 * bir öğeyi yalnızca ekleyen kişi ya da yönetici silebilir.
 */

import {
  type BankaOzet,
  type Ekleyen,
  type HavuzDizin,
  HavuzHatasi,
  type SoruOzet,
  dizinIsle,
  dizinOku,
  ogeOku,
  ogeSil,
  ogeYaz,
} from "./depo.ts";

export type Kullanici = Ekleyen & { yonetici: boolean };

const AZAMI_GORSEL = 3_500_000;

type SoruGirdi = {
  id?: unknown;
  imageDataUrl?: unknown;
  createdAt?: unknown;
  source?: unknown;
  label?: unknown;
  pdfSourceName?: unknown;
  pdfPage?: unknown;
  answerKey?: unknown;
  [k: string]: unknown;
};

type BankaGirdi = {
  id?: unknown;
  ders?: unknown;
  sinif?: unknown;
  konu?: unknown;
  zorluk?: unknown;
  tip?: unknown;
  etiket?: unknown;
  blok?: unknown;
  olusturma?: unknown;
};

const metin = (v: unknown, azami = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, azami) : undefined;
const sayi = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function kimlik(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(v)) throw new HavuzHatasi("Geçersiz kimlik.", 400);
  return v;
}

export async function havuzListesi(): Promise<Omit<HavuzDizin, "silinen">> {
  const d = await dizinOku();
  return {
    sorular: [...d.sorular].sort((a, b) => b.createdAt - a.createdAt),
    banka: [...d.banka].sort((a, b) => b.olusturma - a.olusturma),
  };
}

/** Yeni soru ekler ya da var olanı günceller (cevap anahtarı, silgi vb.). */
export async function soruKaydet(
  g: SoruGirdi,
  k: Kullanici
): Promise<{ durum: "kaydedildi" | "silinmis" | "baskasinin" }> {
  const id = kimlik(g.id);
  const gorsel = g.imageDataUrl;
  if (typeof gorsel !== "string" || !gorsel.startsWith("data:image/")) {
    throw new HavuzHatasi("Soru görseli eksik.", 400);
  }
  if (gorsel.length > AZAMI_GORSEL) throw new HavuzHatasi("Soru görseli çok büyük.", 413);

  const onceki = await dizinOku();
  if (onceki.silinen.includes(id)) return { durum: "silinmis" };
  const var_ = onceki.sorular.find((s) => s.id === id);
  // Havuzdan alınan bir soruda yapılan değişiklik (cevap, silgi) başkasının
  // sorusunu herkes için değiştirmesin; o değişiklik yalnızca o tarayıcıda kalır.
  if (var_ && !silebilirMi(var_.ekleyen, k)) return { durum: "baskasinin" };
  const ekleyen = var_?.ekleyen ?? { id: k.id, ad: k.ad };

  await ogeYaz("soru", id, { ...g, id });
  const ozet: SoruOzet = {
    id,
    ekleyen,
    createdAt: sayi(g.createdAt) ?? var_?.createdAt ?? Date.now(),
    guncelleme: Date.now(),
    source: metin(g.source, 20),
    label: metin(g.label),
    pdfSourceName: metin(g.pdfSourceName),
    pdfPage: sayi(g.pdfPage),
    answerKey: metin(g.answerKey, 2),
  };
  const durum = await dizinIsle((d) => {
    if (d.silinen.includes(id)) return "silinmis" as const;
    d.sorular = [ozet, ...d.sorular.filter((s) => s.id !== id)];
    return "kaydedildi" as const;
  });
  if (durum === "silinmis") await ogeSil("soru", id);
  return { durum };
}

export async function bankaKaydet(g: BankaGirdi, k: Kullanici): Promise<{ durum: "kaydedildi" | "silinmis" }> {
  const id = kimlik(g.id);
  if (!g.blok || typeof g.blok !== "object") throw new HavuzHatasi("Föy bloğu eksik.", 400);
  const onceki = await dizinOku();
  if (onceki.silinen.includes(id)) return { durum: "silinmis" };
  const var_ = onceki.banka.find((s) => s.id === id);
  if (var_ && !silebilirMi(var_.ekleyen, k)) return { durum: "kaydedildi" };

  const kayit = {
    id,
    ders: metin(g.ders) ?? "",
    sinif: metin(g.sinif, 10) ?? "",
    konu: metin(g.konu) ?? "",
    zorluk: metin(g.zorluk, 40) ?? "",
    tip: metin(g.tip, 40) ?? "",
    blok: g.blok,
    olusturma: sayi(g.olusturma) ?? var_?.olusturma ?? Date.now(),
  };
  await ogeYaz("banka", id, kayit);
  const { blok: _blok, ...geri } = kayit;
  const ozet: BankaOzet = {
    ...geri,
    ekleyen: var_?.ekleyen ?? { id: k.id, ad: k.ad },
    etiket: metin(g.etiket, 160) ?? "",
  };
  const durum = await dizinIsle((d) => {
    if (d.silinen.includes(id)) return "silinmis" as const;
    d.banka = [ozet, ...d.banka.filter((s) => s.id !== id)];
    return "kaydedildi" as const;
  });
  if (durum === "silinmis") await ogeSil("banka", id);
  return { durum };
}

export async function ogeGetir(tur: "soru" | "banka", id: string): Promise<unknown> {
  const veri = await ogeOku(tur, kimlik(id));
  if (!veri) throw new HavuzHatasi("Bulunamadı.", 404);
  return veri;
}

export async function soruGorseli(id: string): Promise<{ tur: string; bayt: Buffer }> {
  const veri = (await ogeGetir("soru", id)) as { imageDataUrl?: string };
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(veri.imageDataUrl ?? "");
  if (!m) throw new HavuzHatasi("Görsel okunamadı.", 404);
  return { tur: m[1], bayt: Buffer.from(m[2], "base64") };
}

export function silebilirMi(ekleyen: Ekleyen, k: Kullanici): boolean {
  return k.yonetici || ekleyen.id === k.id;
}

export async function ogeKaldir(tur: "soru" | "banka", idHam: string, k: Kullanici): Promise<void> {
  const id = kimlik(idHam);
  const bulundu = await dizinIsle((d) => {
    const liste: { id: string; ekleyen: Ekleyen }[] = tur === "soru" ? d.sorular : d.banka;
    const oge = liste.find((s) => s.id === id);
    if (!oge) return false;
    if (!silebilirMi(oge.ekleyen, k)) {
      throw new HavuzHatasi("Bu öğeyi yalnızca ekleyen kişi ya da yönetici silebilir.", 403);
    }
    if (tur === "soru") d.sorular = d.sorular.filter((s) => s.id !== id);
    else d.banka = d.banka.filter((s) => s.id !== id);
    if (!d.silinen.includes(id)) d.silinen.push(id);
    return true;
  });
  if (bulundu) await ogeSil(tur, id);
}
