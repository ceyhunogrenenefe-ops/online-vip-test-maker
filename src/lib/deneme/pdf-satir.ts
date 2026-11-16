import type { MetinSatir } from "./model";

type Parca = {
  metin: string;
  x: number;
  y: number;
  w: number;
  h: number;
  guven?: number;
};

/** Aynı satırdaki PDF parçalarını soldan sağa birleştirir. */
export function satirlaraBol(parcalar: Parca[]): MetinSatir[] {
  const sirali = [...parcalar]
    .filter((p) => p.metin.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const satirlar: MetinSatir[] = [];
  for (const p of sirali) {
    const son = satirlar[satirlar.length - 1];
    const esik = Math.max(4, Math.min(son?.h ?? p.h, p.h) * 0.6);
    if (son && Math.abs(p.y - son.y) <= esik) {
      const bosluk = p.x > son.x + son.w + 1.5 ? " " : "";
      son.metin = `${son.metin}${bosluk}${p.metin}`.replace(/\s+/g, " ").trim();
      const sag = Math.max(son.x + son.w, p.x + p.w);
      son.x = Math.min(son.x, p.x);
      son.w = sag - son.x;
      son.h = Math.max(son.h, p.h);
      if (typeof p.guven === "number") {
        son.guven = typeof son.guven === "number" ? Math.min(son.guven, p.guven) : p.guven;
      }
    } else {
      satirlar.push({
        metin: p.metin.replace(/\s+/g, " ").trim(),
        x: p.x,
        y: p.y,
        w: Math.max(p.w, 4),
        h: Math.max(p.h, 8),
        guven: p.guven,
      });
    }
  }
  return satirlar;
}

/**
 * Deneme sayfası soldan aşağı, sonra sağ sütundan aşağı okunur.
 * Tam genişlikteki ders başlığı sütunları böler.
 */
export function sinavSatirlari(parcalar: Parca[], genislik: number): MetinSatir[] {
  const dolu = parcalar.filter((p) => p.metin.trim());
  if (!dolu.length || genislik < 100) return satirlaraBol(dolu);
  const span = dolu.filter((p) => p.w >= genislik * 0.55);
  const dar = dolu.filter((p) => p.w < genislik * 0.55);
  const sol = dar.filter((p) => p.x + p.w / 2 < genislik * 0.5);
  const sag = dar.filter((p) => p.x + p.w / 2 >= genislik * 0.5);
  if (sol.length < 4 || sag.length < 4) return satirlaraBol(dolu);

  const bantlar = satirlaraBol(span);
  const solSatir = satirlaraBol(sol);
  const sagSatir = satirlaraBol(sag);
  const noktalar = [Number.NEGATIVE_INFINITY, ...bantlar.map((b) => b.y), Number.POSITIVE_INFINITY];
  const sonuc: MetinSatir[] = [];
  for (let i = 0; i < noktalar.length - 1; i++) {
    const y0 = noktalar[i];
    const y1 = noktalar[i + 1];
    if (i > 0) sonuc.push(bantlar[i - 1]);
    const icinde = (s: MetinSatir) => s.y > y0 + 0.5 && s.y < y1 - 0.5;
    sonuc.push(...solSatir.filter(icinde), ...sagSatir.filter(icinde));
  }
  return sonuc;
}
