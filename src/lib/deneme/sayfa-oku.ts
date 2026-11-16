"use client";

/**
 * PDF sayfalarını görsele çevirir ve kelime konumlarını çıkarır.
 * Metin katmanı boşsa (taranmış sayfa) Tesseract ile OCR yapılır.
 * Tüm koordinatlar PDF punto biriminde, sol üst köşe başlangıçlıdır.
 */

import { openPdfDocument } from "../pdf-document";
import type { Kelime, SayfaVeri } from "./kesim";
import type { Kutu } from "./model";
import { anahtarSayfasiMi } from "./anahtar";
import { bolmeBul, boslukSonrasiniAt, icerikSiniri, kenarNumaralari } from "./piksel";

export type OkunanSayfa = SayfaVeri & {
  gorsel: Blob;
  olcek: number;
  ocr: boolean;
  anahtar: boolean;
  /** Yalnız cevap anahtarı sayfalarında: kutunun boyalı oranı (işaretli şık). */
  doluluk?: (k: Kutu) => number;
};

type OcrIsci = {
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  recognize: (img: HTMLCanvasElement) => Promise<{
    data: { text?: string; words?: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] };
  }>;
  terminate: () => Promise<unknown>;
};

let isci: Promise<OcrIsci> | null = null;
let rakamIsci: Promise<OcrIsci> | null = null;

/** Tesseract dil verisini CDN'den indirir; ağ engelliyse sonsuza dek beklemesin. */
function sureli<T>(p: Promise<T>, ms: number, mesaj: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(mesaj)), ms))]);
}

const OCR_HATA = "OCR dil dosyası indirilemedi (cdn.jsdelivr.net erişimi gerekli). İnterneti kontrol edip tekrar deneyin.";

function ocrIsci(): Promise<OcrIsci> {
  if (!isci) {
    isci = sureli(
      import("tesseract.js").then(async ({ createWorker }) => (await createWorker("tur")) as unknown as OcrIsci),
      120_000,
      OCR_HATA
    ).catch((e) => {
      isci = null;
      throw e;
    });
  }
  return isci;
}

/** Tek satır, yalnız rakam: kenarda tek başına duran "1." gibi numaralar için. */
function rakamOcr(): Promise<OcrIsci> {
  if (!rakamIsci) {
    rakamIsci = sureli(
      import("tesseract.js").then(async ({ createWorker }) => {
        const w = (await createWorker("eng")) as unknown as OcrIsci;
        await w.setParameters({ tessedit_char_whitelist: "0123456789.", tessedit_pageseg_mode: "7" });
        return w;
      }),
      120_000,
      OCR_HATA
    ).catch((e) => {
      rakamIsci = null;
      throw e;
    });
  }
  return rakamIsci;
}

export async function ocrKapat() {
  for (const p of [isci, rakamIsci]) if (p) await (await p).terminate();
  isci = null;
  rakamIsci = null;
}

/** Gri/renkli yazıyı siyaha çeker; Tesseract ince gri rakamları böyle okuyabiliyor. */
function ikiliTuval(veri: ImageData, x = 0, y = 0, w = veri.width, h = veri.height, buyut = 1, pay = 0) {
  const c = document.createElement("canvas");
  c.width = w * buyut + pay * 2;
  c.height = h * buyut + pay * 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  const kucuk = ctx.createImageData(w, h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = ((y + yy) * veri.width + (x + xx)) * 4;
      const v = veri.data[i] + veri.data[i + 1] + veri.data[i + 2] < 600 ? 0 : 255;
      const j = (yy * w + xx) * 4;
      kucuk.data[j] = kucuk.data[j + 1] = kucuk.data[j + 2] = v;
      kucuk.data[j + 3] = 255;
    }
  }
  if (buyut === 1 && !pay) {
    ctx.putImageData(kucuk, 0, 0);
    return c;
  }
  const ara = document.createElement("canvas");
  ara.width = w;
  ara.height = h;
  ara.getContext("2d")!.putImageData(kucuk, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ara, pay, pay, w * buyut, h * buyut);
  return c;
}

/** Sayfayı 24 yatay şeride bölüp her şeritte x başına koyu piksel sayar. */
function seritProfili(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const y0 = Math.floor(h * 0.06);
  const y1 = Math.floor(h * 0.94);
  const veri = ctx.getImageData(0, y0, w, y1 - y0).data;
  const adet = 24;
  const seritH = Math.floor((y1 - y0) / adet);
  const seritler: Uint32Array[] = [];
  for (let i = 0; i < adet; i++) {
    const koyu = new Uint32Array(w);
    for (let y = i * seritH; y < (i + 1) * seritH; y++) {
      const satir = y * w * 4;
      for (let x = 0; x < w; x++) {
        const j = satir + x * 4;
        if (veri[j] + veri[j + 1] + veri[j + 2] < 540) koyu[x]++;
      }
    }
    seritler.push(koyu);
  }
  return { seritler, seritH };
}

function metinKelimeleri(
  items: unknown[],
  sayfaH: number
): Kelime[] {
  const out: Kelime[] = [];
  for (const it of items) {
    const item = it as { str?: string; transform?: number[]; width?: number; height?: number };
    if (!item.str || !item.str.trim() || !item.transform) continue;
    const [, , c, d, e, f] = item.transform;
    const h = item.height || Math.hypot(c, d) || 10;
    const genislik = item.width || item.str.length * h * 0.5;
    const harfW = genislik / item.str.length;
    const y = sayfaH - f - h;
    let i = 0;
    for (const parca of item.str.split(/(\s+)/)) {
      if (parca.trim()) out.push({ metin: parca, x: e + i * harfW, y, w: parca.length * harfW, h });
      i += parca.length;
    }
  }
  return out;
}

export async function pdfOku(
  dosya: File,
  ilerleme: (mesaj: string) => void
): Promise<OkunanSayfa[]> {
  const doc = await openPdfDocument(dosya);
  const sayfalar: OkunanSayfa[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    ilerleme(`Sayfa ${n}/${doc.numPages} okunuyor`);
    const page = await doc.getPage(n);
    const taban = page.getViewport({ scale: 1 });
    const olcek = Math.min(2.5, 1600 / taban.width);
    const vp = page.getViewport({ scale: olcek });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Sayfa görseli oluşturulamadı.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const icerik = await page.getTextContent();
    let kelimeler = metinKelimeleri(icerik.items, taban.height);
    const govdeMetni = kelimeler
      .filter((k) => k.y > taban.height * 0.1 && k.y < taban.height * 0.92)
      .map((k) => k.metin)
      .join("");
    // Gövdede metin katmanı yoksa sayfa taranmış ya da sorular resim olarak gömülü.
    const ocr = govdeMetni.length < 60;
    const { seritler, seritH } = seritProfili(ctx, canvas.width, canvas.height);
    const bolmePx = bolmeBul(seritler, seritH);
    const tum = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const koyu = (x: number, y: number) => {
      const i = (y * tum.width + x) * 4;
      return tum.data[i] + tum.data[i + 1] + tum.data[i + 2] < 600;
    };
    if (ocr) {
      ilerleme(`Sayfa ${n}/${doc.numPages}: resim/taranmış, OCR ile okunuyor`);
      const { data } = await (await ocrIsci()).recognize(ikiliTuval(tum));
      kelimeler = (data.words || [])
        .filter((w) => w.text.trim() && w.confidence > 30)
        .map((w) => ({
          metin: w.text.trim(),
          x: w.bbox.x0 / olcek,
          y: w.bbox.y0 / olcek,
          w: (w.bbox.x1 - w.bbox.x0) / olcek,
          h: (w.bbox.y1 - w.bbox.y0) / olcek,
        }));
      // OCR'ın kaçırdığı, kenarda tek duran numaralar.
      const bolgeler: [number, number][] =
        bolmePx == null ? [[0, canvas.width]] : [[0, Math.round(bolmePx)], [Math.round(bolmePx), canvas.width]];
      for (const [x0, x1] of bolgeler) {
        const atla = (y: number) => x0 > 0 && [-3, -2, -1, 0, 1, 2, 3].some((d) => koyu(x0 + d, y));
        const bloblar = kenarNumaralari(
          koyu,
          { x0, x1, y0: Math.floor(canvas.height * 0.08), y1: Math.floor(canvas.height * 0.95) },
          10 * olcek,
          atla
        );
        for (const bl of bloblar) {
          const ustunde = (k: Kelime) =>
            k.y * olcek < bl.y + bl.h &&
            (k.y + k.h) * olcek > bl.y &&
            k.x * olcek < bl.x + bl.w + 5 &&
            (k.x + k.w) * olcek > bl.x - 5;
          if (kelimeler.some((k) => /^\d{1,3}[.,)]/.test(k.metin) && ustunde(k))) continue;
          // OCR noktasız "2" ya da çöp okuduysa onu at, yerine kenar numarasını koy.
          kelimeler = kelimeler.filter((k) => !ustunde(k));
          const px = Math.max(0, bl.x - 6);
          const py = Math.max(0, bl.y - 6);
          const kesit = ikiliTuval(tum, px, py, Math.min(bl.w + 12, tum.width - px), Math.min(bl.h + 12, tum.height - py), 3, 30);
          const { data: r } = await (await rakamOcr()).recognize(kesit);
          const metin = (r.text || "").trim();
          const no = metin.match(/^(\d{1,3})/);
          kelimeler.push({ metin: no ? `${no[1]}.` : "#.", x: bl.x / olcek, y: bl.y / olcek, w: bl.w / olcek, h: bl.h / olcek });
        }
      }
    }
    const anahtar = anahtarSayfasiMi(kelimeler);
    const doluluk = anahtar
      ? (k: Kutu) => {
          let dolu = 0;
          let toplam = 0;
          for (let y = Math.max(0, Math.round(k.y * olcek)); y < Math.min(tum.height, (k.y + k.h) * olcek); y++) {
            for (let x = Math.max(0, Math.round(k.x * olcek)); x < Math.min(tum.width, (k.x + k.w) * olcek); x++) {
              const i = (y * tum.width + x) * 4;
              const r = tum.data[i];
              const g = tum.data[i + 1];
              const b = tum.data[i + 2];
              toplam++;
              if (Math.max(r, g, b) - Math.min(r, g, b) > 60 || r + g + b < 300) dolu++;
            }
          }
          return toplam ? dolu / toplam : 0;
        }
      : undefined;
    const gorsel = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("Sayfa kaydedilemedi."))), "image/jpeg", 0.9)
    );
    sayfalar.push({
      sayfa: n,
      genislik: taban.width,
      yukseklik: taban.height,
      kelimeler,
      bolmeX: bolmePx == null ? null : bolmePx / olcek,
      gorsel,
      olcek,
      ocr,
      anahtar,
      doluluk,
    });
    canvas.width = 0;
    canvas.height = 0;
  }
  return sayfalar;
}

const bitmapOnbellek = new Map<Blob, Promise<ImageBitmap>>();

function bitmap(b: Blob) {
  let p = bitmapOnbellek.get(b);
  if (!p) {
    if (bitmapOnbellek.size > 6) {
      const ilk = bitmapOnbellek.keys().next().value as Blob;
      void bitmapOnbellek.get(ilk)?.then((x) => x.close());
      bitmapOnbellek.delete(ilk);
    }
    p = createImageBitmap(b);
    bitmapOnbellek.set(b, p);
  }
  return p;
}

function tuvalBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Kesit kaydedilemedi."))), "image/jpeg", 0.88)
  );
}

/** Kutuyu sayfadan keser, eski numarayı beyazlar, boş kenarları atar. */
export async function kutuKes(
  sayfaGorsel: Blob,
  olcek: number,
  kutu: Kutu,
  beyazla: Kutu[] = []
): Promise<HTMLCanvasElement> {
  const bmp = await bitmap(sayfaGorsel);
  const x = Math.max(0, Math.round(kutu.x * olcek));
  const y = Math.max(0, Math.round(kutu.y * olcek));
  const w = Math.max(2, Math.min(bmp.width - x, Math.round(kutu.w * olcek)));
  const h = Math.max(2, Math.min(bmp.height - y, Math.round(kutu.h * olcek)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, x, y, w, h, 0, 0, w, h);
  for (const b of beyazla) {
    ctx.fillRect(Math.round(b.x * olcek) - x, Math.round(b.y * olcek) - y, Math.round(b.w * olcek), Math.round(b.h * olcek));
  }
  // Kenardaki dikey sütun çizgisi boş alanın kırpılmasını engellemesin.
  const resim = ctx.getImageData(0, 0, w, h);
  const veri = resim.data;
  const kenarBand = Math.max(4, Math.round(w * 0.06));
  for (let x = 0; x < w; x++) {
    if (x >= kenarBand && x < w - kenarBand) continue;
    let koyu = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (veri[i] + veri[i + 1] + veri[i + 2] <= 690) koyu++;
    }
    if (koyu > h * 0.6) for (let y = 0; y < h; y++) veri.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 3);
  }
  ctx.putImageData(resim, 0, 0);
  // 22 mm'den uzun boşluktan sonrası soruya ait değildir (sayfa altlığı, logo).
  const satirDolu = (py: number) => {
    let n = 0;
    for (let px = 0; px < w; px += 2) {
      const i = (py * w + px) * 4;
      if (veri[i] + veri[i + 1] + veri[i + 2] <= 690 && ++n > 1) return true;
    }
    return false;
  };
  const kesH = boslukSonrasiniAt(h, satirDolu, Math.round((22 / 25.4) * 72 * olcek));
  const sinir = icerikSiniri(w, kesH, (px, py) => {
    const i = (py * w + px) * 4;
    return veri[i] + veri[i + 1] + veri[i + 2] > 690;
  }, Math.round(4 * olcek));
  if (!sinir) return c;
  const t = document.createElement("canvas");
  t.width = sinir.w;
  t.height = sinir.h;
  const tc = t.getContext("2d")!;
  tc.drawImage(c, sinir.x, sinir.y, sinir.w, sinir.h, 0, 0, sinir.w, sinir.h);
  return t;
}

export async function kesitBlob(sayfaGorsel: Blob, olcek: number, kutu: Kutu, beyazla: Kutu[] = []) {
  return tuvalBlob(await kutuKes(sayfaGorsel, olcek, kutu, beyazla));
}

/** Ortak metnin parçalarını alt alta tek görsele dizer. */
export async function parcalariBirlestir(parcalar: HTMLCanvasElement[]): Promise<Blob> {
  const w = Math.max(...parcalar.map((p) => p.width));
  const h = parcalar.reduce((t, p) => t + p.height, 0);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  let y = 0;
  for (const p of parcalar) {
    ctx.drawImage(p, 0, y);
    y += p.height;
  }
  return tuvalBlob(c);
}
