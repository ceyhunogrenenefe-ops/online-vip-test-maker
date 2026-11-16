import type { PuanSonuc, SecilenSoru, Sik, Soru } from "./model";

export function netHesap(dogru: number, yanlis: number, ceza: number): number {
  const ham = dogru - yanlis * ceza;
  return Math.round(ham * 100) / 100;
}

/** Ders ders doğru, yanlış, boş ve net. Anahtarı olmayan soru puana girmez. */
export function puanla(
  secilen: SecilenSoru[],
  havuz: Map<string, Soru>,
  cevaplar: Record<string, Sik | "">,
  ceza: number
): PuanSonuc {
  const dersSirasi: string[] = [];
  const kova = new Map<string, { dogru: number; yanlis: number; bos: number }>();
  for (const sec of secilen) {
    const soru = havuz.get(sec.soruId);
    if (!soru?.dogru) continue;
    if (!kova.has(sec.ders)) {
      dersSirasi.push(sec.ders);
      kova.set(sec.ders, { dogru: 0, yanlis: 0, bos: 0 });
    }
    const hucre = kova.get(sec.ders)!;
    const cevap = cevaplar[sec.soruId];
    if (!cevap) hucre.bos += 1;
    else if (cevap === soru.dogru) hucre.dogru += 1;
    else hucre.yanlis += 1;
  }
  const dersler = dersSirasi.map((ders) => {
    const h = kova.get(ders)!;
    return { ders, ...h, net: netHesap(h.dogru, h.yanlis, ceza) };
  });
  const dogru = dersler.reduce((t, d) => t + d.dogru, 0);
  const yanlis = dersler.reduce((t, d) => t + d.yanlis, 0);
  const bos = dersler.reduce((t, d) => t + d.bos, 0);
  return { dersler, dogru, yanlis, bos, net: netHesap(dogru, yanlis, ceza) };
}
