/**
 * Yüklenen fotoğrafı OCR öncesi düzeltir.
 *
 * Öğretmen ders kitabından telefonla fotoğraf çekiyor: sayfa eğik, ışık
 * dengesiz, arka plan gri. OCR'ı doğrudan bu görüntüye uygulamak kötü
 * sonuç verir. Buradaki adımlar hem tanımayı hem de — görsel olarak
 * saklanacaksa — föydeki görünümü düzeltir (spec 2, adım 1-2).
 *
 * Tamamı tarayıcıda çalışır; hiçbir görüntü dışarı gönderilmez.
 */

export type HazirlikSecenekleri = {
  /** Gri tona çevir */
  griTon?: boolean;
  /** Yerel eşikleme ile metni netleştir */
  esikle?: boolean;
  /** Eğikliği ölç ve düzelt */
  egiklikDuzelt?: boolean;
  /** Uzun kenarı bu piksele ölçekle (OCR için 1600-2000 iyi) */
  hedefUzunKenar?: number;
};

export type HazirlikSonucu = {
  dataUrl: string;
  genislik: number;
  yukseklik: number;
  /** Ölçülen eğiklik (derece); düzeltme kapalıysa da raporlanır */
  egiklikDerece: number;
};

async function gorseliYukle(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel okunamadı"));
    img.src = src;
  });
}

function tuvalOlustur(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas açılamadı");
  return { c, ctx };
}

/** Gri tona çevirir (parlaklık ağırlıklı). */
function griYap(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

/**
 * Uyarlamalı eşikleme (kutu ortalaması).
 * Sabit eşik, telefonla çekilmiş gölgeli fotoğrafta sayfanın yarısını
 * siyaha boyuyor; yerel ortalama bunu önlüyor.
 */
function uyarlamaliEsikle(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  pencere = 25,
  sapma = 10
) {
  // Bütünleyici görüntü ile hızlı kutu ortalaması
  const bt = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let satirToplam = 0;
    for (let x = 0; x < w; x++) {
      satirToplam += d[(y * w + x) * 4];
      bt[(y + 1) * (w + 1) + (x + 1)] = bt[y * (w + 1) + (x + 1)] + satirToplam;
    }
  }
  const r = Math.max(1, pencere >> 1);
  const cikti = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const alan = (y1 - y0 + 1) * (x1 - x0 + 1);
      const toplam =
        bt[(y1 + 1) * (w + 1) + (x1 + 1)] -
        bt[y0 * (w + 1) + (x1 + 1)] -
        bt[(y1 + 1) * (w + 1) + x0] +
        bt[y0 * (w + 1) + x0];
      const ort = toplam / alan;
      const i = (y * w + x) * 4;
      const v = d[i] < ort - sapma ? 0 : 255;
      cikti[i] = cikti[i + 1] = cikti[i + 2] = v;
      cikti[i + 3] = 255;
    }
  }
  d.set(cikti);
}

/**
 * Eğikliği metin satırlarının yatay izdüşümünden tahmin eder.
 * Belirli açılarda döndürülmüş izdüşümün varyansı en yüksek olduğunda
 * satırlar yatayla hizalanmış demektir.
 */
function egiklikOlc(d: Uint8ClampedArray, w: number, h: number): number {
  const adim = Math.max(1, Math.floor(h / 400));
  let enIyiAci = 0;
  let enIyiSkor = -1;
  for (let aci = -6; aci <= 6; aci += 0.5) {
    const rad = (aci * Math.PI) / 180;
    const tan = Math.tan(rad);
    const izdusum = new Float64Array(h);
    for (let y = 0; y < h; y += adim) {
      let koyu = 0;
      for (let x = 0; x < w; x += 2) {
        const yy = (y + tan * (x - w / 2)) | 0;
        if (yy < 0 || yy >= h) continue;
        if (d[(yy * w + x) * 4] < 128) koyu++;
      }
      izdusum[y] = koyu;
    }
    // Varyans
    let ort = 0;
    let n = 0;
    for (let y = 0; y < h; y += adim) {
      ort += izdusum[y];
      n++;
    }
    ort /= n || 1;
    let varyans = 0;
    for (let y = 0; y < h; y += adim) varyans += (izdusum[y] - ort) ** 2;
    if (varyans > enIyiSkor) {
      enIyiSkor = varyans;
      enIyiAci = aci;
    }
  }
  return enIyiAci;
}

export async function prepareImage(
  dataUrl: string,
  {
    griTon = true,
    esikle = true,
    egiklikDuzelt = true,
    hedefUzunKenar = 1800,
  }: HazirlikSecenekleri = {}
): Promise<HazirlikSonucu> {
  const img = await gorseliYukle(dataUrl);

  // 1) Ölçekle — çok büyük fotoğraflar hem yavaş hem gereksiz
  const uzun = Math.max(img.naturalWidth, img.naturalHeight);
  const k = uzun > hedefUzunKenar ? hedefUzunKenar / uzun : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));

  const { c, ctx } = tuvalOlustur(w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const veri = ctx.getImageData(0, 0, w, h);
  if (griTon) griYap(veri.data);
  if (esikle) uyarlamaliEsikle(veri.data, w, h);
  ctx.putImageData(veri, 0, 0);

  let egiklik = 0;
  if (egiklikDuzelt) {
    const olcum = ctx.getImageData(0, 0, w, h);
    egiklik = egiklikOlc(olcum.data, w, h);
    if (Math.abs(egiklik) >= 0.5) {
      const { c: c2, ctx: ctx2 } = tuvalOlustur(w, h);
      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, w, h);
      ctx2.translate(w / 2, h / 2);
      ctx2.rotate((-egiklik * Math.PI) / 180);
      ctx2.drawImage(c, -w / 2, -h / 2);
      return {
        dataUrl: c2.toDataURL("image/png"),
        genislik: w,
        yukseklik: h,
        egiklikDerece: egiklik,
      };
    }
  }

  return {
    dataUrl: c.toDataURL("image/png"),
    genislik: w,
    yukseklik: h,
    egiklikDerece: egiklik,
  };
}
