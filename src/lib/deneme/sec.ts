import type { Bolum, EksikDers, SecilenSoru, Soru } from "./model";
import { norm } from "./turkce.ts";

export type SecimSonuc = {
  sorular: SecilenSoru[];
  eksikler: EksikDers[];
};

function kok(metin: string): string {
  return norm(metin).slice(0, 180);
}

/** Her dersten istenen kadar soru seçer. Aynı soru ve aynı kök ikinci kez girmez. */
export function soruSec(havuz: Soru[], bolumler: Bolum[], pdfIdler: string[]): SecimSonuc {
  const izin = new Set(pdfIdler);
  const kullanilan = new Set<string>();
  const kokler = new Set<string>();
  const sorular: SecilenSoru[] = [];
  const eksikler: EksikDers[] = [];
  let sira = 1;

  for (const bolum of bolumler) {
    for (const istek of bolum.dersler) {
      if (istek.adet <= 0) continue;
      const ders = norm(istek.ders);
      const aday = havuz.filter((s) => izin.has(s.pdfId) && norm(s.ders) === ders);
      const incelemede = aday.filter((s) => s.inceleme || !s.dogru).length;
      const hazir = aday.filter((s) => {
        const k = kok(s.metin);
        return !s.inceleme && s.dogru && !kullanilan.has(s.id) && (!k || !kokler.has(k));
      });
      const al = hazir.slice(0, istek.adet);
      for (const s of al) {
        kullanilan.add(s.id);
        const k = kok(s.metin);
        if (k) kokler.add(k);
        sorular.push({ soruId: s.id, bolumId: bolum.id, ders: s.ders, sira: sira++ });
      }
      if (al.length < istek.adet) {
        eksikler.push({
          ders: istek.ders,
          bulunan: hazir.length,
          gereken: istek.adet,
          incelemede,
        });
      }
    }
  }
  return { sorular, eksikler };
}

export function eksikleriHesapla(bolumler: Bolum[], secilen: SecilenSoru[]): EksikDers[] {
  const eksikler: EksikDers[] = [];
  for (const bolum of bolumler) {
    for (const istek of bolum.dersler) {
      if (istek.adet <= 0) continue;
      const bulunan = secilen.filter(
        (s) => s.bolumId === bolum.id && norm(s.ders) === norm(istek.ders)
      ).length;
      if (bulunan < istek.adet) {
        eksikler.push({
          ders: istek.ders,
          bulunan,
          gereken: istek.adet,
          incelemede: 0,
        });
      }
    }
  }
  return eksikler;
}
