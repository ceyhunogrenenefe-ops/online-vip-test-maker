/**
 * Branş denemesi: bir formatın tek testinden (LGS Türkçe) ya da çok dersli
 * bir testin tek dersinden (TYT Fen › Fizik) istenen sayıda soruluk deneme.
 * Sorular yine o formatın havuzundan, aynı test/ders adıyla seçilir.
 */

import { tumTestler, type FormatTest, type SinavFormati } from "./format.ts";

export type BransSecim = { test: string; ders: string | null };

export type BransSecenek = BransSecim & { ad: string; adet: number };

export type BransOturum = {
  ad: string;
  sureDakika: number;
  testler: { ad: string; baslik?: string; dersler: { ad: string; adet: number }[] }[];
};

export const BRANS_ADETLERI = [10, 20, 30, 40];

/** Formatın branş seçenekleri: her test, çok dersli testlerde ayrıca her ders. */
export function bransSecenekleri(f: SinavFormati): BransSecenek[] {
  const out: BransSecenek[] = [];
  for (const t of tumTestler(f)) {
    out.push({ test: t.ad, ders: null, ad: t.ad, adet: t.dersler.reduce((a, d) => a + d.adet, 0) });
    if (t.dersler.length > 1) {
      for (const d of t.dersler) out.push({ test: t.ad, ders: d.ad, ad: `${t.ad} › ${d.ad}`, adet: d.adet });
    }
  }
  return out;
}

export function bransAdi(s: BransSecim): string {
  return s.ders ?? s.test;
}

/** Toplamı alt derslere oranla dağıtır (en büyük kalan yöntemi). */
export function oranlaDagit(dersler: { ad: string; adet: number }[], toplam: number): { ad: string; adet: number }[] {
  const temel = dersler.reduce((a, d) => a + d.adet, 0) || dersler.length;
  const ham = dersler.map((d) => (toplam * (d.adet || 1)) / temel);
  const out = ham.map((h, i) => ({ ad: dersler[i].ad, adet: Math.floor(h) }));
  let kalan = toplam - out.reduce((a, d) => a + d.adet, 0);
  const sira = ham.map((h, i) => ({ i, k: h - Math.floor(h) })).sort((a, b) => b.k - a.k || a.i - b.i);
  for (const { i } of sira) {
    if (kalan <= 0) break;
    out[i].adet++;
    kalan--;
  }
  return out;
}

/** Branş denemesinin tek oturumu. Süre, formattaki soru başına süreyle orantılı (5 dk'ya yuvarlı). */
export function bransOturumu(f: SinavFormati, s: BransSecim, toplam: number): BransOturum {
  const adet = Math.max(1, Math.min(200, Math.round(toplam) || 1));
  let test: FormatTest | undefined;
  const oturum = f.oturumlar.find((o) => (test = o.testler.find((t) => t.ad === s.test)));
  if (!oturum || !test) throw new Error(`${f.ad} formatında "${s.test}" testi yok.`);
  if (s.ders && !test.dersler.some((d) => d.ad === s.ders)) throw new Error(`"${s.test}" testinde "${s.ders}" dersi yok.`);
  const oturumAdet = oturum.testler.reduce((a, t) => a + t.dersler.reduce((b, d) => b + d.adet, 0), 0);
  const sure = Math.max(5, Math.round(((oturum.sureDakika / oturumAdet) * adet) / 5) * 5);
  const ad = bransAdi(s);
  return {
    ad: `${ad} Branş Denemesi`,
    sureDakika: sure,
    testler: [
      {
        ad: test.ad,
        ...(s.ders && s.ders !== test.ad ? { baslik: s.ders } : {}),
        dersler: s.ders ? [{ ad: s.ders, adet }] : oranlaDagit(test.dersler, adet),
      },
    ],
  };
}
