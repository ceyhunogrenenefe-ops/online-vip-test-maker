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
