"use client";

import { anahtarCoz } from "./anahtar";
import { formatBul, numaradanDers, tumTestler } from "./format";
import {
  gorselleriYaz,
  gruplariOku,
  gruplariYaz,
  pdfleriOku,
  pdfleriYaz,
  sayfaOku,
  sayfalariYaz,
  sorulariOku,
  sorulariYaz,
  type HavuzGrup,
  type HavuzPdf,
  type HavuzSoru,
} from "./havuz";
import { sorulariBul } from "./kesim";
import type { Sik } from "./model";
import { kesitBlob, kutuKes, parcalariBirlestir, pdfOku } from "./sayfa-oku";

export type IceAktarSonuc = { pdf: HavuzPdf; soru: number; cevapli: number; ocrSayfa: number };

export async function pdfIceAktar(
  dosya: File,
  formatId: string,
  tekTest: number | null,
  ilerleme: (mesaj: string) => void
): Promise<IceAktarSonuc> {
  const format = formatBul(formatId);
  const testler = tumTestler(format);
  const sayfalar = await pdfOku(dosya, ilerleme);
  const pdfId = crypto.randomUUID();

  ilerleme("Sorular ayrılıyor");
  const soruSayfalari = sayfalar.filter((s) => !s.anahtar);
  const { sorular: bulunan, gruplar: bulunanGrup } = sorulariBul(soruSayfalari, { testler, tekTest });

  const anahtar = new Map<string, Sik>();
  for (const s of sayfalar.filter((x) => x.anahtar)) {
    for (const [k, v] of anahtarCoz(s.kelimeler, testler, tekTest, s.doluluk)) if (!anahtar.has(k)) anahtar.set(k, v);
  }

  const sayfaBlob = new Map(sayfalar.map((s) => [s.sayfa, s]));
  const simdi = Date.now();
  const sorular: HavuzSoru[] = [];
  const gorseller: [string, Blob][] = [];
  for (let i = 0; i < bulunan.length; i++) {
    const b = bulunan[i];
    if (i % 5 === 0) ilerleme(`Soru kesiliyor ${i + 1}/${bulunan.length}`);
    const sayfa = sayfaBlob.get(b.sayfa)!;
    const test = testler[b.testIndex];
    const id = crypto.randomUUID();
    sorular.push({
      id,
      pdfId,
      formatId,
      test: test.ad,
      ders: numaradanDers(test, b.numara),
      numara: b.numara,
      dogru: anahtar.get(`${b.testIndex}:${b.numara}`) ?? null,
      sayfa: b.sayfa,
      kutu: b.kutu,
      noKutu: b.noKutu,
      grupId: b.grupId ? `${pdfId}:${b.grupId}` : null,
      kullanim: 0,
      surum: simdi,
    });
    gorseller.push([id, await kesitBlob(sayfa.gorsel, sayfa.olcek, b.kutu, b.noKutu ? [b.noKutu] : [])]);
  }
  const gruplar: HavuzGrup[] = [];
  for (const g of bulunanGrup) {
    const id = `${pdfId}:${g.id}`;
    const parcalar = await Promise.all(
      g.parcalar.map((p) => {
        const s = sayfaBlob.get(p.sayfa)!;
        return kutuKes(s.gorsel, s.olcek, p.kutu);
      })
    );
    gruplar.push({ id, pdfId, parcalar: g.parcalar, surum: simdi });
    gorseller.push([id, await parcalariBirlestir(parcalar)]);
  }

  ilerleme("Havuza kaydediliyor");
  const pdf: HavuzPdf = {
    id: pdfId,
    ad: dosya.name.replace(/\.pdf$/i, ""),
    formatId,
    tekTest,
    sayfaSayisi: sayfalar.length,
    sayfalar: sayfalar.map((s) => ({ genislik: s.genislik, yukseklik: s.yukseklik, olcek: s.olcek, ocr: s.ocr })),
    yukleme: simdi,
    anahtarBulunan: sorular.filter((s) => s.dogru).length,
  };
  await sayfalariYaz(pdfId, sayfalar.map((s) => s.gorsel));
  await gorselleriYaz(gorseller);
  await sorulariYaz([...(await sorulariOku()), ...sorular]);
  await gruplariYaz([...(await gruplariOku()), ...gruplar]);
  await pdfleriYaz([pdf, ...(await pdfleriOku())]);
  return { pdf, soru: sorular.length, cevapli: pdf.anahtarBulunan, ocrSayfa: sayfalar.filter((s) => s.ocr).length };
}

/** Kutusu değişen soruyu sayfa görselinden yeniden keser. */
export async function soruYenidenKes(pdf: HavuzPdf, soru: HavuzSoru): Promise<HavuzSoru> {
  const sayfa = await sayfaOku(pdf.id, soru.sayfa);
  if (!sayfa) throw new Error("Sayfa görseli bulunamadı.");
  const olcek = pdf.sayfalar[soru.sayfa - 1].olcek;
  // Numara kutusu artık soru kutusunun içinde değilse beyazlanmaz.
  const n = soru.noKutu;
  const icinde = n && n.x >= soru.kutu.x - 2 && n.y >= soru.kutu.y - 2 && n.y + n.h <= soru.kutu.y + soru.kutu.h + 2;
  await gorselleriYaz([[soru.id, await kesitBlob(sayfa, olcek, soru.kutu, icinde && n ? [n] : [])]]);
  return { ...soru, surum: Date.now() };
}
