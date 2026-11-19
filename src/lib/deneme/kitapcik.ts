"use client";

/**
 * Basılı deneme kitapçığı (yayınevi düzeni). A4, iki sütun; her test yeni
 * sayfada, ilk sayfasında talimatlarla başlar. Geniş (tam sayfa genişliğinde
 * kesilmiş) sorular iki sütunu birden kaplar. Kesitteki eski numara silindiği
 * için yeni numara solda basılır. Kapak üretilir ya da yüklenen görsel kullanılır.
 */

import { jsPDF } from "jspdf";
import type { Sik } from "./model";

export type KitapSoru = { gorsel: Blob; dogru: Sik | null; grup: { id: string; gorsel: Blob; adet: number } | null };
export type KitapTest = { ad: string; sorular: KitapSoru[] };
export type KitapOturum = { ad: string; sureDakika: number; testler: KitapTest[] };
export type Kitap = {
  ad: string;
  formatAd: string;
  /** Kapakta sağ üstteki sınav adı ("YÜKSEKÖĞRETİM KURUMLARI SINAVI"). */
  sinavAdi: string;
  kurum: string;
  denemeNo: string;
  kod: string;
  kitapcikTuru: string;
  sikSayisi: 4 | 5;
  ceza: number;
  oturumlar: KitapOturum[];
  /** Kapaktaki büyük yazı; verilmezse "DENEME SINAVI". */
  kapakYazi?: string;
  kapakGorsel?: Blob | null;
  logo?: Blob | null;
};

const A4 = { w: 210, h: 297 };
const KENAR = 13;
const ARA = 9;
const UST = 25;
const UST_ILK = 40;
const ALT_CIZGI = 283;
const ALT = A4.h - ALT_CIZGI + 3;
const NO_W = 6.5;
const SUTUN_W = (A4.w - KENAR * 2 - ARA) / 2;
const LACIVERT: [number, number, number] = [27, 42, 84];
const KIRMIZI: [number, number, number] = [176, 28, 38];
const GRI: [number, number, number] = [90, 90, 90];

const AILE = "KitapSans";
const FONTLAR = [
  ["normal", "NotoSans-Regular.ttf"],
  ["bold", "NotoSans-Bold.ttf"],
  ["italic", "NotoSans-Italic.ttf"],
] as const;
const fontOnbellek = new Map<string, string>();

async function fontYukle(doc: jsPDF): Promise<boolean> {
  try {
    for (const [stil, dosya] of FONTLAR) {
      let b64 = fontOnbellek.get(dosya);
      if (!b64) {
        const r = await fetch(`https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/${dosya}`);
        if (!r.ok) throw new Error("font");
        const bytes = new Uint8Array(await r.arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        b64 = btoa(s);
        fontOnbellek.set(dosya, b64);
      }
      doc.addFileToVFS(dosya, b64);
      doc.addFont(dosya, AILE, stil);
    }
    doc.setFont(AILE, "normal");
    return true;
  } catch {
    doc.setFont("helvetica", "normal");
    return false;
  }
}

let turkceFont = true;
function yazi(doc: jsPDF, stil: "normal" | "bold" | "italic", boy: number, renk: [number, number, number] = [0, 0, 0]) {
  doc.setFont(turkceFont ? AILE : "helvetica", stil);
  doc.setFontSize(boy);
  doc.setTextColor(...renk);
}

type Resim = { veri: Uint8Array; pxW: number; pxH: number; tur: "JPEG" | "PNG" };

async function resim(b: Blob): Promise<Resim> {
  const bmp = await createImageBitmap(b);
  const r = {
    veri: new Uint8Array(await b.arrayBuffer()),
    pxW: bmp.width,
    pxH: bmp.height,
    tur: (b.type.includes("png") ? "PNG" : "JPEG") as "JPEG" | "PNG",
  };
  bmp.close();
  return r;
}

/** Kesit ~180 dpi; doğal genişliği mm'ye çevirir. */
const dogalMm = (r: Resim) => (r.pxW / 180) * 25.4;

function cezaYazi(ceza: number) {
  if (Math.abs(ceza - 1 / 3) < 0.01) return "Üç yanlış cevap bir doğru cevabı götürür.";
  if (Math.abs(ceza - 1 / 4) < 0.01) return "Dört yanlış cevap bir doğru cevabı götürür.";
  if (ceza === 0) return "Yanlış cevaplar doğru cevapları götürmez.";
  return `Her yanlış cevap ${ceza} doğru cevabı götürür.`;
}

function testBasligi(ad: string) {
  const b = ad.toLocaleUpperCase("tr");
  return /TEST/.test(b) ? b : `${b} TESTİ`;
}

/** Görseli kutuya oranını koruyarak sığdırır ve ortalar. */
function sigdir(doc: jsPDF, r: Resim, x: number, y: number, w: number, h: number, kapla = false) {
  const oran = r.pxW / r.pxH;
  let gw = w;
  let gh = w / oran;
  if (kapla ? gh < h : gh > h) {
    gh = h;
    gw = h * oran;
  }
  doc.addImage(r.veri, r.tur, x + (w - gw) / 2, y + (h - gh) / 2, gw, gh);
}

async function kapak(doc: jsPDF, k: Kitap, o: KitapOturum, oturumNo: number) {
  if (k.kapakGorsel) {
    sigdir(doc, await resim(k.kapakGorsel), 0, 0, A4.w, A4.h, true);
    return;
  }
  // Sağ üst köşe şeridi
  doc.setFillColor(232, 238, 248);
  doc.rect(0, 0, A4.w, 48, "F");
  doc.setFillColor(...LACIVERT);
  doc.triangle(110, 0, A4.w, 0, A4.w, 48, "F");

  if (k.logo) sigdir(doc, await resim(k.logo), KENAR, 8, 58, 32);
  else {
    yazi(doc, "bold", 22, KIRMIZI);
    doc.text(doc.splitTextToSize(k.kurum, 85), KENAR, 22);
  }
  yazi(doc, "bold", 10, [255, 255, 255]);
  doc.text(k.sinavAdi.toLocaleUpperCase("tr"), A4.w - KENAR, 12, { align: "right" });
  // Kısa etiket ("LGS (8. Sınıf)" → "LGS"); sığmazsa yazı küçülür.
  const etiket = k.formatAd.replace(/\s*\(.*\)\s*/, "").toLocaleUpperCase("tr");
  let boy = 40;
  yazi(doc, "bold", boy, [255, 255, 255]);
  while (boy > 16 && doc.getTextWidth(etiket) > 80) yazi(doc, "bold", (boy -= 2), [255, 255, 255]);
  doc.text(etiket, A4.w - KENAR, 34, { align: "right" });
  if (k.oturumlar.length > 1) {
    yazi(doc, "bold", 11, [255, 255, 255]);
    doc.text(`${oturumNo}. OTURUM · ${o.ad.toLocaleUpperCase("tr")}`, A4.w - KENAR, 43, { align: "right" });
  }

  // Başlık
  yazi(doc, "bold", 15, LACIVERT);
  doc.text(k.ad.toLocaleUpperCase("tr"), A4.w / 2, 62, { align: "center" });
  yazi(doc, "bold", 46, KIRMIZI);
  doc.text(k.kapakYazi ?? "DENEME SINAVI", A4.w / 2, 82, { align: "center" });

  // Kitapçık bilgi kutusu
  let y = 92;
  doc.setDrawColor(...LACIVERT);
  doc.setLineWidth(0.6);
  doc.roundedRect(KENAR, y, A4.w - KENAR * 2, 30, 3, 3, "S");
  yazi(doc, "bold", 9, LACIVERT);
  doc.text("KİTAPÇIK TÜRÜ:", KENAR + 5, y + 7);
  yazi(doc, "bold", 30, LACIVERT);
  doc.text(k.kitapcikTuru, KENAR + 16, y + 24, { align: "center" });
  yazi(doc, "bold", 9, LACIVERT);
  doc.text("DENEME NO:", A4.w - KENAR - 5, y + 7, { align: "right" });
  yazi(doc, "bold", 30, LACIVERT);
  doc.text(k.denemeNo || "1", A4.w - KENAR - 17, y + 24, { align: "center" });
  const kod = (k.kod || "").toUpperCase().slice(0, 10).split("");
  const hucre = 7.5;
  const kodW = Math.max(8, kod.length) * hucre;
  const kodX = A4.w / 2 - kodW / 2;
  doc.setLineWidth(0.3);
  doc.rect(kodX, y + 4, kodW, 10);
  yazi(doc, "bold", 8, LACIVERT);
  doc.text("SORU KİTAPÇIK NUMARASI", A4.w / 2, y + 8, { align: "center" });
  doc.text("(SINAV KODU)", A4.w / 2, y + 12, { align: "center" });
  for (let i = 0; i < Math.max(8, kod.length); i++) {
    doc.rect(kodX + i * hucre, y + 16, hucre, 9);
    yazi(doc, "bold", 12, [0, 0, 0]);
    if (kod[i]) doc.text(kod[i], kodX + i * hucre + hucre / 2, y + 22.5, { align: "center" });
  }

  // Aday bilgileri
  y = 128;
  const satirlar = ["T.C. KİMLİK NUMARASI", "ADI", "SOYADI", "SALON NO."];
  doc.setLineWidth(0.5);
  doc.roundedRect(KENAR, y, A4.w - KENAR * 2, satirlar.length * 9, 2, 2, "S");
  doc.setLineWidth(0.2);
  satirlar.forEach((s, i) => {
    const yy = y + i * 9;
    if (i) doc.line(KENAR, yy, A4.w - KENAR, yy);
    yazi(doc, "bold", 9, [0, 0, 0]);
    doc.text(s, KENAR + 4, yy + 6);
  });
  doc.line(KENAR + 55, y, KENAR + 55, y + satirlar.length * 9);
  yazi(doc, "bold", 9, [0, 0, 0]);
  doc.text("SIRA NO.", A4.w - KENAR - 30, y + 3 * 9 + 6, { align: "right" });

  // Adayın dikkatine
  y = 172;
  yazi(doc, "bold", 11, KIRMIZI);
  doc.text("ADAYIN DİKKATİNE!", KENAR, y);
  yazi(doc, "bold", 9, [0, 0, 0]);
  doc.text("SINAV BAŞLAMADAN ÖNCE AŞAĞIDAKİ UYARILARI MUTLAKA OKUYUNUZ.", KENAR, y + 5);
  const toplam = o.testler.reduce((t, x) => t + x.sorular.length, 0);
  const maddeler = [
    "Adınızı, soyadınızı ve numaranızı kitapçık ve cevap kâğıdı üzerindeki ilgili alanlara yazınız.",
    `Bu oturumda ${o.testler.map((t) => `${t.ad} (${t.sorular.length})`).join(", ")} olmak üzere toplam ${toplam} soru vardır. Sınav süresi ${o.sureDakika} dakikadır.`,
    `Cevaplarınızı cevap kâğıdına kurşun kalemle işaretleyiniz. ${cezaYazi(k.ceza)}`,
    "Soru kitapçığı numaranızı cevap kâğıdındaki ilgili alana kodlayınız; kodlamama ya da yanlış kodlama sorumluluğu size aittir.",
  ];
  let my = y + 12;
  maddeler.forEach((m, i) => {
    yazi(doc, "bold", 10, KIRMIZI);
    doc.text(`${i + 1}.`, KENAR, my);
    yazi(doc, "normal", 9.5, [0, 0, 0]);
    const satir = doc.splitTextToSize(m, A4.w - KENAR * 2 - 7);
    doc.text(satir, KENAR + 6, my);
    my += satir.length * 4.6 + 2.5;
  });

  // İmza kutusu ve kurum
  doc.setFillColor(...LACIVERT);
  doc.rect(KENAR, 255, 100, 24, "F");
  yazi(doc, "normal", 8.5, [255, 255, 255]);
  doc.text(["Adayın İmzası:", "Soru kitapçık numarasını cevap", "kâğıdındaki alana doğru kodladım."], KENAR + 3, 261);
  doc.setFillColor(255, 255, 255);
  doc.rect(KENAR + 64, 259, 32, 16, "F");
  yazi(doc, "bold", 13, KIRMIZI);
  doc.text(k.kurum, A4.w - KENAR, 272, { align: "right" });
}

export async function kitapcikOlustur(k: Kitap, ilerleme: (m: string) => void = () => {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  turkceFont = await fontYukle(doc);
  let ilkSayfa = true;
  const yeniSayfa = () => {
    if (!ilkSayfa) doc.addPage();
    ilkSayfa = false;
    return doc.getNumberOfPages();
  };
  /** Soru sayfaları: altlık sonradan çizilir ("Diğer sayfaya geçiniz." son sayfada değişir). */
  const soruSayfalari: { no: number; sonOturumSayfasi: boolean }[] = [];

  for (let oi = 0; oi < k.oturumlar.length; oi++) {
    const o = k.oturumlar[oi];
    yeniSayfa();
    await kapak(doc, k, o, oi + 1);
    const oturumBas = soruSayfalari.length;

    for (const t of o.testler) {
      if (!t.sorular.length) continue;
      const baslik = testBasligi(t.ad);
      const sayfaAc = (ilk: boolean) => {
        const no = yeniSayfa();
        soruSayfalari.push({ no, sonOturumSayfasi: false });
        yazi(doc, "bold", 9, GRI);
        doc.text(k.formatAd, KENAR, 14);
        yazi(doc, "bold", 14, [0, 0, 0]);
        doc.text(baslik, A4.w / 2, 15, { align: "center" });
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(KENAR, 18.5, A4.w - KENAR, 18.5);
        let ust = UST;
        if (ilk) {
          yazi(doc, "bold", 9.5, [0, 0, 0]);
          doc.text(`1.  Bu testte ${t.sorular.length} soru vardır.`, KENAR + 2, 25);
          doc.text(
            doc.splitTextToSize(`2.  Cevaplarınızı, cevap kâğıdının ${t.ad} Testi için ayrılan kısmına işaretleyiniz.`, A4.w - KENAR * 2 - 4)[0],
            KENAR + 2,
            30.5
          );
          doc.setLineWidth(0.3);
          doc.line(KENAR, 34.5, A4.w - KENAR, 34.5);
          ust = UST_ILK;
        }
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.25);
        doc.line(A4.w / 2, ust - 2, A4.w / 2, ALT_CIZGI - 2);
        return ust;
      };

      let bas = sayfaAc(true);
      const y = [bas, bas];
      let sutun = 0;
      const sayfaGec = () => {
        bas = sayfaAc(false);
        y[0] = y[1] = bas;
        sutun = 0;
      };
      const sinir = ALT_CIZGI - 4;
      const yer = (h: number, genis: boolean) => {
        if (genis) {
          if (Math.max(y[0], y[1]) + h > sinir && Math.max(y[0], y[1]) > bas) sayfaGec();
          return { x: KENAR, y: Math.max(y[0], y[1]), genis: true };
        }
        if (y[sutun] + h > sinir && y[sutun] > bas) {
          if (sutun === 0) sutun = 1;
          else sayfaGec();
          if (y[sutun] + h > sinir && y[sutun] > bas) sayfaGec();
        }
        return { x: KENAR + sutun * (SUTUN_W + ARA), y: y[sutun], genis: false };
      };
      const ilerlet = (p: { y: number; genis: boolean }, h: number) => {
        if (p.genis) y[0] = y[1] = p.y + h + 9;
        else y[sutun] = p.y + h + 9;
      };
      const boyut = (r: Resim, genis: boolean) => {
        const alan = (genis ? A4.w - KENAR * 2 : SUTUN_W) - NO_W;
        let w = Math.min(dogalMm(r), alan);
        let h = (w * r.pxH) / r.pxW;
        const enFazla = sinir - UST;
        if (h > enFazla) {
          w = (w * enFazla) / h;
          h = enFazla;
        }
        return { w, h };
      };

      const basilanGrup = new Set<string>();
      for (let i = 0; i < t.sorular.length; i++) {
        const s = t.sorular[i];
        ilerleme(`${t.ad}: ${i + 1}/${t.sorular.length}`);
        if (s.grup && !basilanGrup.has(s.grup.id)) {
          basilanGrup.add(s.grup.id);
          const r = await resim(s.grup.gorsel);
          const genis = dogalMm(r) > SUTUN_W * 1.3;
          const b = boyut(r, genis);
          const p = yer(b.h + 7, genis);
          yazi(doc, "bold", 9.5, [0, 0, 0]);
          doc.text(`${i + 1}. - ${i + s.grup.adet}. soruları aşağıdaki metne göre cevaplayınız.`, p.x, p.y + 3.5);
          doc.addImage(r.veri, r.tur, p.x + NO_W, p.y + 6, b.w, b.h);
          ilerlet(p, b.h + 6);
        }
        const r = await resim(s.gorsel);
        const genis = dogalMm(r) > SUTUN_W * 1.3;
        const b = boyut(r, genis);
        const p = yer(b.h, genis);
        yazi(doc, "bold", 10.5, [0, 0, 0]);
        doc.text(`${i + 1}.`, p.x, p.y + 4);
        doc.addImage(r.veri, r.tur, p.x + NO_W, p.y, b.w, b.h);
        ilerlet(p, b.h);
      }
    }
    if (soruSayfalari.length > oturumBas) soruSayfalari[soruSayfalari.length - 1].sonOturumSayfasi = true;
  }

  // Altlıklar
  let sira = 0;
  for (const s of soruSayfalari) {
    sira++;
    doc.setPage(s.no);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(KENAR, ALT_CIZGI, A4.w - KENAR, ALT_CIZGI);
    yazi(doc, "bold", 10, [0, 0, 0]);
    doc.text(String(sira), A4.w / 2, ALT_CIZGI + 5.5, { align: "center" });
    yazi(doc, "normal", 7.5, GRI);
    doc.text(k.kurum, KENAR, ALT_CIZGI + 5.5);
    yazi(doc, "italic", 9, [0, 0, 0]);
    doc.text(s.sonOturumSayfasi ? "Cevaplarınızı kontrol ediniz." : "Diğer sayfaya geçiniz.", A4.w - KENAR, ALT_CIZGI + 5.5, {
      align: "right",
    });
  }

  doc.setPage(doc.getNumberOfPages());
  doc.addPage();
  optikForm(doc, k);
  return doc.output("blob");
}

function optikForm(doc: jsPDF, k: Kitap) {
  yazi(doc, "bold", 9, GRI);
  doc.text(k.kurum, KENAR, 14);
  yazi(doc, "bold", 14, [0, 0, 0]);
  doc.text("CEVAP KÂĞIDI", A4.w / 2, 15, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(KENAR, 18.5, A4.w - KENAR, 18.5);
  yazi(doc, "normal", 9.5, [0, 0, 0]);
  doc.text(`${k.ad} · ${k.formatAd} · Kitapçık ${k.kitapcikTuru}`, KENAR, 25);
  doc.setLineWidth(0.3);
  doc.rect(KENAR, 28, 110, 8);
  doc.rect(KENAR + 114, 28, A4.w - KENAR * 2 - 114, 8);
  yazi(doc, "bold", 8, [0, 0, 0]);
  doc.text("ADI SOYADI", KENAR + 2, 33);
  doc.text("NUMARA", KENAR + 116, 33);

  const harfler = "ABCDE".slice(0, k.sikSayisi).split("");
  const sutunlar: { baslik: string; bas: number; adet: number }[] = [];
  for (const o of k.oturumlar)
    for (const t of o.testler)
      for (let bas = 0; bas < t.sorular.length; bas += 20)
        sutunlar.push({ baslik: bas ? `${t.ad} (devam)` : t.ad, bas, adet: Math.min(20, t.sorular.length - bas) });
  const satirH = 5.8;
  const genislik = 10 + harfler.length * 5.6;
  const sigan = Math.max(1, Math.floor((A4.w - KENAR * 2 + 4) / (genislik + 4)));
  let x = KENAR;
  let y0 = 44;
  sutunlar.forEach((s, i) => {
    if (i && i % sigan === 0) {
      x = KENAR;
      y0 += 20 * satirH + 18;
      if (y0 + 20 * satirH > ALT_CIZGI) {
        doc.addPage();
        y0 = 24;
      }
    }
    doc.setFillColor(...LACIVERT);
    doc.rect(x, y0 - 4.5, genislik, 6, "F");
    yazi(doc, "bold", 6.5, [255, 255, 255]);
    doc.text(doc.splitTextToSize(s.baslik.toLocaleUpperCase("tr"), genislik - 2)[0], x + genislik / 2, y0 - 0.5, { align: "center" });
    doc.setDrawColor(...LACIVERT);
    doc.setLineWidth(0.3);
    doc.rect(x, y0 + 1.5, genislik, s.adet * satirH + 1.5);
    for (let r = 0; r < s.adet; r++) {
      const yy = y0 + 5.5 + r * satirH;
      yazi(doc, "bold", 7, [0, 0, 0]);
      doc.text(String(s.bas + r + 1), x + 7, yy + 1.2, { align: "right" });
      harfler.forEach((h, hi) => {
        const cx = x + 11 + hi * 5.6;
        doc.setDrawColor(70, 70, 70);
        doc.circle(cx, yy, 2.1, "S");
        yazi(doc, "normal", 5.5, GRI);
        doc.text(h, cx, yy + 0.8, { align: "center" });
      });
    }
    x += genislik + 4;
  });
}

export async function cevapAnahtariPdf(k: Kitap): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  turkceFont = await fontYukle(doc);
  yazi(doc, "bold", 9, GRI);
  doc.text(k.kurum, KENAR, 14);
  yazi(doc, "bold", 14, [0, 0, 0]);
  doc.text("CEVAP ANAHTARI", A4.w / 2, 15, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(KENAR, 18.5, A4.w - KENAR, 18.5);
  yazi(doc, "bold", 11, LACIVERT);
  doc.text(`${k.ad} · ${k.formatAd} · Kitapçık ${k.kitapcikTuru}`, KENAR, 26);
  let y = 34;
  const hucreW = (A4.w - KENAR * 2) / 10;
  for (const o of k.oturumlar) {
    for (const t of o.testler) {
      const satir = Math.ceil(t.sorular.length / 10);
      if (y + 9 + satir * 7 > ALT_CIZGI) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(...LACIVERT);
      doc.rect(KENAR, y, A4.w - KENAR * 2, 7, "F");
      yazi(doc, "bold", 10, [255, 255, 255]);
      doc.text(testBasligi(t.ad), KENAR + 3, y + 5);
      doc.setDrawColor(...LACIVERT);
      doc.setLineWidth(0.2);
      t.sorular.forEach((s, i) => {
        const hx = KENAR + (i % 10) * hucreW;
        const hy = y + 7 + Math.floor(i / 10) * 7;
        doc.rect(hx, hy, hucreW, 7);
        yazi(doc, "normal", 9, GRI);
        doc.text(`${i + 1}.`, hx + 2, hy + 4.8);
        yazi(doc, "bold", 11, [0, 0, 0]);
        doc.text(s.dogru ?? "-", hx + hucreW - 4, hy + 5, { align: "center" });
      });
      y += 7 + satir * 7 + 7;
    }
  }
  return doc.output("blob");
}
