/**
 * SMS alıcısı kurum kaydından gelir.
 * Koçluk öğrencisinde ayrı bir "telefon doğrulandı" sütunu yok;
 * öğrenci kartındaki telefon ve veli telefonu kurum kaydı sayılır.
 * Birden fazla aynı ad varsa yanlış kişiye gitmemek için numara istenir.
 */

import { norm, telefonE164 } from "./turkce.ts";

export type KurumOgrenci = {
  id: string;
  ad: string;
  telefon: string | null;
  veliTelefon: string | null;
};

export type TelefonKarar = {
  telefon: string;
  kaynak: "ogrenci" | "veli" | "giris";
  gerekli: boolean;
  ogrenciId: string | null;
};

export function ayniKisi(kayitAd: string, ad: string, soyad: string): boolean {
  return norm(kayitAd) === norm(`${ad} ${soyad}`);
}

export function telefonKarari(opts: {
  ad: string;
  soyad: string;
  alici: "ogrenci" | "veli";
  kayitlar: KurumOgrenci[];
  girilen?: string;
}): TelefonKarar {
  const eslesen = opts.kayitlar.filter((k) => ayniKisi(k.ad, opts.ad, opts.soyad));
  if (eslesen.length === 1) {
    const k = eslesen[0];
    const ham = opts.alici === "veli" ? k.veliTelefon : k.telefon;
    const e164 = ham ? telefonE164(ham) : null;
    if (e164) {
      return { telefon: e164, kaynak: opts.alici, gerekli: false, ogrenciId: k.id };
    }
  }
  const girilen = opts.girilen ? telefonE164(opts.girilen) : null;
  return {
    telefon: girilen || "",
    kaynak: "giris",
    gerekli: !girilen,
    ogrenciId: eslesen.length === 1 ? eslesen[0].id : null,
  };
}
