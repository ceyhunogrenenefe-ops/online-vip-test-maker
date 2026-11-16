import { openPdfDocument } from "../pdf-document";
import { ocrTurkce } from "../ocr-text";
import { ayikla } from "./ayikla";
import type { AyiklananSoru, Kutu, SayfaGirdi } from "./model";
import { satirlaraBol } from "./pdf-satir";

type Kanvas = { canvas: HTMLCanvasElement; scale: number };

function kirp(kaynak: Kanvas | undefined, kutu: Kutu | null): string | null {
  if (!kaynak || !kutu || kutu.w < 2 || kutu.h < 2) return null;
  const { canvas, scale } = kaynak;
  const x = Math.max(0, Math.floor(kutu.x * scale));
  const y = Math.max(0, Math.floor(kutu.y * scale));
  const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(kutu.w * scale)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.ceil(kutu.h * scale)));
  if (w < 2 || h < 2) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return jpegSigdir(c);
}

/** Üç soruluk kayıt Vercel gövde sınırının altında kalsın. */
function jpegSigdir(kaynak: HTMLCanvasElement): string {
  let tuval = kaynak;
  for (let tur = 0; tur < 4; tur++) {
    let kalite = 0.72;
    let url = tuval.toDataURL("image/jpeg", kalite);
    while (url.length > 900_000 && kalite > 0.45) {
      kalite -= 0.1;
      url = tuval.toDataURL("image/jpeg", kalite);
    }
    if (url.length <= 900_000) return url;
    const kucuk = document.createElement("canvas");
    kucuk.width = Math.max(2, Math.round(tuval.width * 0.7));
    kucuk.height = Math.max(2, Math.round(tuval.height * 0.7));
    const ctx = kucuk.getContext("2d");
    if (!ctx) return url;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, kucuk.width, kucuk.height);
    ctx.drawImage(tuval, 0, 0, kucuk.width, kucuk.height);
    tuval = kucuk;
  }
  return tuval.toDataURL("image/jpeg", 0.5);
}

export function gorselSigdir(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve(jpegSigdir(c));
    };
    img.onerror = () => reject(new Error("Kesilen görsel okunamadı."));
    img.src = dataUrl;
  });
}

/**
 * Metin katmanı doluysa onu kullanır. Sayfa taranmışsa OCR satırlarını
 * aynı ayıklayıcıya verir; formül ve şekil görseli kırpılır, metne çevrilmez.
 */
export async function pdfdenAyikla(
  file: File,
  ilerleme?: (mesaj: string) => void
): Promise<{ sayfaSayisi: number; sorular: { soru: AyiklananSoru; gorsel: string | null; ortakGorsel: string | null }[] }> {
  const doc = await openPdfDocument(file);
  const sayfalar: SayfaGirdi[] = [];
  const kanvaslar = new Map<number, Kanvas>();

  for (let n = 1; n <= doc.numPages; n++) {
    ilerleme?.(`${file.name}: sayfa ${n}/${doc.numPages}`);
    const page = await doc.getPage(n);
    const taban = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1400 / taban.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sayfa görseli oluşmadı");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const task = page.render({ canvasContext: ctx, viewport });
    await task.promise;
    kanvaslar.set(n, { canvas, scale });

    const icerik = await page.getTextContent();
    const parcalar: { metin: string; x: number; y: number; w: number; h: number }[] = [];
    for (const item of icerik.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const h = item.height || 12;
      parcalar.push({
        metin: item.str,
        x: item.transform[4],
        y: taban.height - item.transform[5] - h,
        w: item.width || 8,
        h,
      });
    }
    let satirlar = satirlaraBol(parcalar);
    const ham = satirlar.map((s) => s.metin).join("");
    const ocr = ham.replace(/\s/g, "").length < 25;
    if (ocr) {
      ilerleme?.(`${file.name}: sayfa ${n} taranmış, yazı okunuyor`);
      const sonuc = await ocrTurkce(canvas.toDataURL("image/jpeg", 0.85));
      satirlar = satirlaraBol(
        sonuc.satirlar
          .filter((s) => s.text.trim())
          .map((s) => ({
            metin: s.text,
            x: s.bbox.x0 / scale,
            y: s.bbox.y0 / scale,
            w: Math.max(4, (s.bbox.x1 - s.bbox.x0) / scale),
            h: Math.max(8, (s.bbox.y1 - s.bbox.y0) / scale),
            guven: s.confidence,
          }))
      );
    }
    sayfalar.push({
      sayfa: n,
      genislik: taban.width,
      yukseklik: taban.height,
      ocr,
      satirlar,
    });
  }

  const ayik = ayikla(sayfalar);
  const ortak = new Map<string, string | null>();
  const sorular = ayik.map((soru) => {
    let ortakGorsel: string | null = null;
    if (soru.grupId && soru.ortakKutu) {
      if (!ortak.has(soru.grupId)) ortak.set(soru.grupId, kirp(kanvaslar.get(soru.sayfa), soru.ortakKutu));
      ortakGorsel = ortak.get(soru.grupId) ?? null;
    }
    return { soru, gorsel: kirp(kanvaslar.get(soru.sayfa), soru.kutu), ortakGorsel };
  });
  return { sayfaSayisi: doc.numPages, sorular };
}

/** Cevap anahtarı PDF’indeki yazıyı düz metin olarak okur. */
export async function pdfDuzMetin(file: File): Promise<string> {
  const doc = await openPdfDocument(file);
  const satirlar: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const icerik = await page.getTextContent();
    const parca: string[] = [];
    let y = -1;
    for (const item of icerik.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const satirY = Math.round(item.transform[5]);
      if (y >= 0 && Math.abs(satirY - y) > 4) parca.push("\n");
      else if (parca.length) parca.push(" ");
      parca.push(item.str.trim());
      y = satirY;
    }
    satirlar.push(parca.join(""));
  }
  return satirlar.join("\n");
}
