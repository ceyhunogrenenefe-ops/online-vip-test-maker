"use client";

/**
 * Basılı deneme kitapçığı. A4, iki sütun; her test yeni sayfada başlar.
 * Geniş (tam sayfa genişliğinde kesilmiş) sorular iki sütunu birden kaplar.
 * Kesitteki eski numara silindiği için yeni numara solda basılır.
 */

import { jsPDF } from "jspdf";
import { registerTurkishFont, setTurkishFont } from "../pdf-font";
import type { Sik } from "./model";

export type KitapSoru = { gorsel: Blob; dogru: Sik | null; grup: { id: string; gorsel: Blob; adet: number } | null };
export type KitapTest = { ad: string; sorular: KitapSoru[] };
export type KitapOturum = { ad: string; sureDakika: number; testler: KitapTest[] };
export type Kitap = { ad: string; formatAd: string; kurum: string; sikSayisi: 4 | 5; ceza: number; oturumlar: KitapOturum[] };

const A4 = { w: 210, h: 297 };
const KENAR = 12;
const ARA = 8;
const UST = 24;
const ALT = 16;
const NO_W = 7;
const SUTUN_W = (A4.w - KENAR * 2 - ARA) / 2;
const LACIVERT: [number, number, number] = [23, 59, 112];

type Resim = { veri: Uint8Array; pxW: number; pxH: number };

async function resim(b: Blob): Promise<Resim> {
  const bmp = await createImageBitmap(b);
  const r = { veri: new Uint8Array(await b.arrayBuffer()), pxW: bmp.width, pxH: bmp.height };
  bmp.close();
  return r;
}

/** Kesit 180 dpi civarında; doğal genişliği mm'ye çevirir. */
function dogalMm(r: Resim) {
  return (r.pxW / 180) * 25.4;
}

function cezaYazi(ceza: number) {
  if (Math.abs(ceza - 1 / 3) < 0.01) return "3 yanlış 1 doğruyu götürür.";
  if (Math.abs(ceza - 1 / 4) < 0.01) return "4 yanlış 1 doğruyu götürür.";
  if (ceza === 0) return "Yanlış cevaplar doğruları götürmez.";
  return `Her yanlış ${ceza} doğruyu götürür.`;
}

function ustBilgi(doc: jsPDF, k: Kitap, baslik: string) {
  doc.setFillColor(...LACIVERT);
  doc.rect(0, 0, A4.w, 14, "F");
  doc.setTextColor(255, 255, 255);
  setTurkishFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(k.kurum, KENAR, 9);
  doc.text(baslik, A4.w - KENAR, 9, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function altBilgi(doc: jsPDF, k: Kitap, no: number) {
  setTurkishFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(`${k.ad} · ${k.formatAd}`, KENAR, A4.h - 7);
  doc.text(String(no), A4.w - KENAR, A4.h - 7, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function kapak(doc: jsPDF, k: Kitap, o: KitapOturum, oturumNo: number) {
  ustBilgi(doc, k, k.formatAd);
  setTurkishFont(doc, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...LACIVERT);
  doc.text(k.ad, A4.w / 2, 60, { align: "center" });
  doc.setFontSize(16);
  doc.text(k.oturumlar.length > 1 ? `${oturumNo}. Oturum · ${o.ad}` : o.ad, A4.w / 2, 74, { align: "center" });
  doc.setTextColor(0, 0, 0);
  const toplam = o.testler.reduce((t, x) => t + x.sorular.length, 0);
  setTurkishFont(doc, "normal");
  doc.setFontSize(11);
  let y = 100;
  doc.setDrawColor(...LACIVERT);
  doc.setLineWidth(0.4);
  doc.rect(40, y - 8, A4.w - 80, 10 + o.testler.length * 9);
  setTurkishFont(doc, "bold");
  doc.text("Test", 46, y - 1);
  doc.text("Soru sayısı", A4.w - 46, y - 1, { align: "right" });
  setTurkishFont(doc, "normal");
  for (const t of o.testler) {
    y += 9;
    doc.text(t.ad, 46, y - 1);
    doc.text(String(t.sorular.length), A4.w - 46, y - 1, { align: "right" });
  }
  y += 22;
  const maddeler = [
    `Bu oturumda ${toplam} soru vardır. Süre ${o.sureDakika} dakikadır.`,
    "Cevaplarınızı optik forma kurşun kalemle işaretleyiniz.",
    cezaYazi(k.ceza),
    "Sınav başlamadan kitapçığı açmayınız.",
  ];
  for (const m of maddeler) {
    doc.circle(44, y - 1.3, 0.9, "F");
    doc.text(m, 48, y);
    y += 8;
  }
  doc.setFontSize(11);
  doc.text("Adı Soyadı: ..................................................", 40, 230);
  doc.text("Sınıfı / No: ..................................................", 40, 242);
}

export async function kitapcikOlustur(k: Kitap, ilerleme: (m: string) => void = () => {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerTurkishFont(doc);
  let sayfaNo = 0;
  const yeniSayfa = (ilk = false) => {
    if (!ilk) doc.addPage();
    sayfaNo++;
  };
  let ilk = true;

  for (let oi = 0; oi < k.oturumlar.length; oi++) {
    const o = k.oturumlar[oi];
    yeniSayfa(ilk);
    ilk = false;
    kapak(doc, k, o, oi + 1);
    altBilgi(doc, k, sayfaNo);

    for (const t of o.testler) {
      if (!t.sorular.length) continue;
      yeniSayfa();
      ustBilgi(doc, k, t.ad.toLocaleUpperCase("tr"));
      setTurkishFont(doc, "normal");
      doc.setFontSize(9);
      doc.text(`Bu testte ${t.sorular.length} soru vardır.`, KENAR, UST - 4);
      const cizgi = () => {
        doc.setDrawColor(190, 190, 190);
        doc.setLineWidth(0.2);
        doc.line(A4.w / 2, UST, A4.w / 2, A4.h - ALT);
      };
      cizgi();
      altBilgi(doc, k, sayfaNo);

      const y = [UST, UST];
      let sutun = 0;
      const sayfaGec = () => {
        yeniSayfa();
        ustBilgi(doc, k, t.ad.toLocaleUpperCase("tr"));
        cizgi();
        altBilgi(doc, k, sayfaNo);
        y[0] = y[1] = UST;
        sutun = 0;
      };
      const yer = (h: number, genis: boolean) => {
        const sinir = A4.h - ALT;
        if (genis) {
          const bas = Math.max(y[0], y[1]);
          if (bas + h > sinir && bas > UST) sayfaGec();
          return { x: KENAR, y: Math.max(y[0], y[1]), genis: true };
        }
        if (y[sutun] + h > sinir && y[sutun] > UST) {
          if (sutun === 0) sutun = 1;
          else sayfaGec();
          if (y[sutun] + h > sinir && y[sutun] > UST) sayfaGec();
        }
        return { x: KENAR + sutun * (SUTUN_W + ARA), y: y[sutun], genis: false };
      };
      const ilerlet = (yer: { y: number; genis: boolean }, h: number) => {
        if (yer.genis) y[0] = y[1] = yer.y + h + 5;
        else y[sutun] = yer.y + h + 5;
      };
      const gorselBoyut = (r: Resim, genis: boolean) => {
        const alan = (genis ? A4.w - KENAR * 2 : SUTUN_W) - NO_W;
        let w = Math.min(dogalMm(r), alan);
        let h = (w * r.pxH) / r.pxW;
        const enFazla = A4.h - UST - ALT;
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
          const b = gorselBoyut(r, genis);
          const p = yer(b.h + 7, genis);
          setTurkishFont(doc, "bold");
          doc.setFontSize(9);
          const son = i + s.grup.adet;
          doc.text(`${i + 1}. - ${son}. soruları aşağıdaki metne göre cevaplayınız.`, p.x, p.y + 3.5);
          doc.addImage(r.veri, "JPEG", p.x + NO_W, p.y + 6, b.w, b.h);
          ilerlet(p, b.h + 6);
        }
        const r = await resim(s.gorsel);
        const genis = dogalMm(r) > SUTUN_W * 1.3;
        const b = gorselBoyut(r, genis);
        const p = yer(b.h, genis);
        setTurkishFont(doc, "bold");
        doc.setFontSize(11);
        doc.text(`${i + 1}.`, p.x, p.y + 4.5);
        doc.addImage(r.veri, "JPEG", p.x + NO_W, p.y, b.w, b.h);
        ilerlet(p, b.h);
      }
    }
  }

  // Optik form
  yeniSayfa();
  optikForm(doc, k);
  return doc.output("blob");
}

function optikForm(doc: jsPDF, k: Kitap) {
  ustBilgi(doc, k, "OPTİK FORM");
  setTurkishFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(`${k.ad} · ${k.formatAd}`, KENAR, 22);
  doc.text("Adı Soyadı: ...........................................", KENAR, 30);
  doc.text("Sınıfı / No: .............................", 120, 30);
  const harfler = "ABCDE".slice(0, k.sikSayisi).split("");
  const sutunlar: { baslik: string; bas: number; adet: number }[] = [];
  for (const o of k.oturumlar) {
    for (const t of o.testler) {
      for (let bas = 0; bas < t.sorular.length; bas += 20) {
        sutunlar.push({ baslik: bas ? `${t.ad} (devam)` : t.ad, bas, adet: Math.min(20, t.sorular.length - bas) });
      }
    }
  }
  const satirH = 5.6;
  const genislik = 8 + harfler.length * 5.5;
  const sigan = Math.max(1, Math.floor((A4.w - KENAR * 2 + 4) / (genislik + 4)));
  let x = KENAR;
  let y0 = 40;
  sutunlar.forEach((s, i) => {
    if (i && i % sigan === 0) {
      x = KENAR;
      y0 += 20 * satirH + 16;
      if (y0 + 20 * satirH > A4.h - ALT) {
        doc.addPage();
        y0 = 24;
      }
    }
    setTurkishFont(doc, "bold");
    doc.setFontSize(7);
    doc.text(doc.splitTextToSize(s.baslik, genislik)[0], x, y0);
    setTurkishFont(doc, "normal");
    for (let r = 0; r < s.adet; r++) {
      const yy = y0 + 5 + r * satirH;
      doc.setFontSize(7);
      doc.text(String(s.bas + r + 1), x + 5, yy + 1.2, { align: "right" });
      harfler.forEach((h, hi) => {
        const cx = x + 9 + hi * 5.5;
        doc.setDrawColor(80, 80, 80);
        doc.circle(cx, yy, 2, "S");
        doc.setFontSize(5.5);
        doc.text(h, cx, yy + 0.8, { align: "center" });
      });
    }
    x += genislik + 4;
  });
}

export async function cevapAnahtariPdf(k: Kitap): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerTurkishFont(doc);
  ustBilgi(doc, k, "CEVAP ANAHTARI");
  setTurkishFont(doc, "bold");
  doc.setFontSize(14);
  doc.text(`${k.ad} · ${k.formatAd}`, KENAR, 24);
  let y = 34;
  for (const o of k.oturumlar) {
    for (const t of o.testler) {
      const satir = Math.ceil(t.sorular.length / 10);
      if (y + 8 + satir * 6 > A4.h - ALT) {
        doc.addPage();
        y = 20;
      }
      setTurkishFont(doc, "bold");
      doc.setFontSize(11);
      doc.text(t.ad, KENAR, y);
      setTurkishFont(doc, "normal");
      doc.setFontSize(10);
      t.sorular.forEach((s, i) => {
        const xx = KENAR + (i % 10) * 18.6;
        const yy = y + 6 + Math.floor(i / 10) * 6;
        doc.text(`${i + 1}. ${s.dogru ?? "-"}`, xx, yy);
      });
      y += 12 + satir * 6;
    }
  }
  return doc.output("blob");
}
