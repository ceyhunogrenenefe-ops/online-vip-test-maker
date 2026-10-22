/** Öğretmenin yükleyebildiği PDF tavanı. Yazı tipi ve çizim için pay bırakılır. */
export const PDF_SINIR_BAYT = 40 * 1024 * 1024;
const YEDEK_BAYT = 2 * 1024 * 1024;

const ADIMLAR = [
  { dpi: 160, kalite: 0.74 },
  { dpi: 130, kalite: 0.62 },
  { dpi: 110, kalite: 0.5 },
  { dpi: 90, kalite: 0.4 },
] as const;

/** Her soru görseline düşen bayt. Toplam, 40 MB tavanının altında kalır. */
export function gorselButcesi(adet: number, tavan = PDF_SINIR_BAYT): number {
  const pay = Math.max(1, tavan - YEDEK_BAYT);
  return Math.max(1, Math.floor(pay / Math.max(1, adet)));
}

export function veriBayt(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const govde = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((govde.length * 3) / 4);
}

/** Baskı kutusuna sığan piksel. Kaynak küçükse büyütülmez. */
export function baskiPikseli(
  genislikMm: number,
  yukseklikMm: number,
  dpi: number,
  kaynakW: number,
  kaynakH: number
): { w: number; h: number } {
  const hedefW = Math.max(1, Math.round((Math.max(genislikMm, 1) / 25.4) * dpi));
  const hedefH = Math.max(1, Math.round((Math.max(yukseklikMm, 1) / 25.4) * dpi));
  const oran = Math.min(1, hedefW / Math.max(1, kaynakW), hedefH / Math.max(1, kaynakH));
  return {
    w: Math.max(1, Math.round(Math.max(1, kaynakW) * oran)),
    h: Math.max(1, Math.round(Math.max(1, kaynakH) * oran)),
  };
}

function gorselYukle(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel okunamadı"));
    img.src = src;
  });
}

function tuvaleJpeg(img: HTMLImageElement, w: number, h: number, kalite: number): string {
  const tuval = document.createElement("canvas");
  tuval.width = w;
  tuval.height = h;
  const ctx = tuval.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return tuval.toDataURL("image/jpeg", kalite);
}

export type BaskiGorseli = { url: string; bicim: "JPEG" | "PNG" };

/**
 * Soruyu kağıtta kapladığı milimetreye göre küçültür.
 * Pay aşılırsa netliği kademeli düşürür. Okunamayan görselde kaynak durur.
 */
export async function baskiIcinJpeg(
  dataUrl: string,
  genislikMm: number,
  yukseklikMm: number,
  butce: number
): Promise<BaskiGorseli> {
  const oldugu: BaskiGorseli = {
    url: dataUrl,
    bicim: dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG",
  };
  if (typeof document === "undefined") return oldugu;
  let img: HTMLImageElement;
  try {
    img = await gorselYukle(dataUrl);
  } catch {
    return oldugu;
  }
  let son = oldugu;
  for (const adim of ADIMLAR) {
    const px = baskiPikseli(genislikMm, yukseklikMm, adim.dpi, img.width, img.height);
    const url = tuvaleJpeg(img, px.w, px.h, adim.kalite);
    if (!url) return son.url === dataUrl ? oldugu : son;
    son = { url, bicim: "JPEG" };
    if (veriBayt(url) <= butce) return son;
  }
  let px = baskiPikseli(genislikMm, yukseklikMm, ADIMLAR[ADIMLAR.length - 1].dpi, img.width, img.height);
  while (veriBayt(son.url) > butce && px.w > 160) {
    px = {
      w: Math.max(160, Math.round(px.w * 0.72)),
      h: Math.max(1, Math.round(px.h * 0.72)),
    };
    const url = tuvaleJpeg(img, px.w, px.h, 0.36);
    if (!url) break;
    son = { url, bicim: "JPEG" };
  }
  return son;
}
