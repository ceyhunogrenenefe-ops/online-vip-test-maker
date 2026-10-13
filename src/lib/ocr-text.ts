/**
 * Türkçe metin OCR — Tesseract ile, tarayıcıda.
 *
 * Görüntü DIŞARI GÖNDERİLMEZ; tanıma tamamen istemcide çalışır.
 * Yalnızca dil verisi (tur.traineddata) CDN'den bir kez indirilir.
 *
 * ÖNEMLİ: Bu motor DÜZ METİN içindir. Matematiksel ifadeleri bozar
 * (kesir çizgisini "-", kök işaretini "V" gibi okur). Formül içeren
 * bölgeler bu yüzden OCR'a hiç sokulmaz; öğretmene işaretlenip formül
 * editörüne yönlendirilir (spec 2: "tahmin ederek yanlış oluşturmasın").
 */

import type { PasteBlock } from "./paste-clean";
import { matematikSupheliMi } from "./math-detect";
export { matematikSupheliMi };
import { cleanPastedText } from "./paste-clean";

export type OcrSatir = {
  text: string;
  /** 0-100 — Tesseract'in kendi güven değeri */
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrSonuc = {
  text: string;
  satirlar: OcrSatir[];
  /** Ortalama güven */
  ortalamaGuven: number;
  /** Güveni düşük, öğretmenin bakması gereken satırlar */
  supheliSatirlar: OcrSatir[];
  /** Matematik içerdiği düşünülen, OCR'a güvenilmemesi gereken satırlar */
  formulSupheli: OcrSatir[];
  bloklar: PasteBlock[];
};

/** Bu eşiğin altı "öğretmen kontrol etsin" sayılır. */
export const GUVEN_ESIGI = 75;

type TesseractWorker = {
  recognize: (img: string) => Promise<{
    data: {
      text: string;
      confidence: number;
      lines?: {
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }[];
    };
  }>;
  terminate: () => Promise<unknown>;
};

let worker: TesseractWorker | null = null;

/** Dil verisi büyük; tek seferlik yüklenir. */
async function ocrWorker(ilerleme?: (yuzde: number) => void) {
  if (worker) return worker;
  const { createWorker } = await import("tesseract.js");
  worker = (await createWorker("tur", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (ilerleme && typeof m.progress === "number") {
        ilerleme(Math.round(m.progress * 100));
      }
    },
  })) as unknown as TesseractWorker;
  return worker;
}

export async function ocrTurkce(
  dataUrl: string,
  ilerleme?: (yuzde: number) => void
): Promise<OcrSonuc> {
  const w = await ocrWorker(ilerleme);
  const { data } = await w.recognize(dataUrl);

  const satirlar: OcrSatir[] = (data.lines || [])
    .map((l) => ({
      text: (l.text || "").replace(/\s+$/g, ""),
      confidence: Math.round(l.confidence ?? 0),
      bbox: l.bbox,
    }))
    .filter((l) => l.text.trim());

  const supheliSatirlar = satirlar.filter((l) => l.confidence < GUVEN_ESIGI);
  const formulSupheli = satirlar.filter((l) => matematikSupheliMi(l.text));

  // Formül şüphesi olan satırlar metinden çıkarılmaz ama blok üretirken
  // ayrı işaretlenebilsin diye ham metin de döndürülür.
  const duzMetin = satirlar.map((l) => l.text).join("\n");

  return {
    text: duzMetin,
    satirlar,
    ortalamaGuven: Math.round(data.confidence ?? 0),
    supheliSatirlar,
    formulSupheli,
    bloklar: cleanPastedText(duzMetin).blocks,
  };
}

export async function ocrKapat() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
