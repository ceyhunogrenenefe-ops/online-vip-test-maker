import type { jsPDF } from "jspdf";
import { setTurkishFont } from "./pdf-font";
import { KURUMSAL } from "./pdf-corporate";
import { formulaSizeMm } from "./latex-render";
import type { RenderedFormula } from "./latex-render";
import type { Run } from "./paste-clean";

/**
 * Kurumsal föy içerik bileşenleri — PDF çizimi.
 *
 * Her bileşenin ÖLÇ ve ÇİZ olmak üzere iki işlevi var. Bu ayrım şart:
 * otomatik sayfa yerleşimi (Aşama 5) bir bloğun sütuna sığıp sığmadığını
 * çizmeden bilmek zorunda. Çizerken ölçmeye çalışmak, taşan bloğu geri
 * almayı gerektirir ve jsPDF'te bu mümkün değil.
 */

export type DocBlock =
  | { kind: "sectionTitle"; text: string }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] }
  | { kind: "question"; no?: number; stem: Run[]; options: { label: string; runs: Run[] }[] }
  | { kind: "table"; rows: string[][]; baslikSatiri?: boolean }
  | { kind: "formula"; render: RenderedFormula; latex?: string }
  | { kind: "infoBox"; tone: "bilgi" | "dikkat"; title: string; text: string }
  | { kind: "answerLines"; count: number }
  | { kind: "image"; dataUrl: string; aspect: number; maxHeightMm?: number }
  | { kind: "spacer"; heightMm: number };

const GOVDE_PT = 8.5;
const SATIR_MM = 4.2;
const BASLIK_H_MM = 7;
const SORU_BASLIK_H_MM = 6;
const KUTU_IC_BOSLUK = 3.2;

function govdeYaz(doc: jsPDF, pt = GOVDE_PT, kalin = false) {
  setTurkishFont(doc, kalin ? "bold" : "normal");
  doc.setFontSize(pt);
}

export function runlariDuzMetne(runs: Run[]): string {
  return runs
    .map((r) => {
      // Üst/alt simge düz metinde kaybolmasın
      if (r.sup) return `^${r.text}`;
      if (r.sub) return `_${r.text}`;
      return r.text;
    })
    .join("");
}

function satirlariBol(doc: jsPDF, metin: string, genislikMm: number): string[] {
  govdeYaz(doc);
  return doc.splitTextToSize(metin, genislikMm) as string[];
}

/* ------------------------------------------------------------------ */
/* ÖLÇ                                                                 */
/* ------------------------------------------------------------------ */

export function blokYuksekligi(doc: jsPDF, b: DocBlock, genislikMm: number): number {
  switch (b.kind) {
    case "spacer":
      return b.heightMm;

    case "sectionTitle":
      return BASLIK_H_MM + 3;

    case "paragraph": {
      const satir = satirlariBol(doc, runlariDuzMetne(b.runs), genislikMm);
      return satir.length * SATIR_MM + 2;
    }

    case "list": {
      let h = 0;
      for (const it of b.items) {
        const satir = satirlariBol(doc, runlariDuzMetne(it), genislikMm - 5);
        h += satir.length * SATIR_MM;
      }
      return h + 2;
    }

    case "question": {
      const kok = satirlariBol(doc, runlariDuzMetne(b.stem), genislikMm - 6);
      let h = SORU_BASLIK_H_MM + 2 + kok.length * SATIR_MM + 1.5;
      for (const o of b.options) {
        const satir = satirlariBol(doc, runlariDuzMetne(o.runs), genislikMm - 10);
        h += Math.max(SATIR_MM, satir.length * SATIR_MM);
      }
      return h + 3;
    }

    case "table": {
      // Hücre metni sarmıyor; yükseklik satır sayısına bağlı
      return b.rows.length * 6 + 2;
    }

    case "formula": {
      const o = formulaSizeMm(b.render, 13);
      const k = o.widthMm > genislikMm - 8 ? (genislikMm - 8) / o.widthMm : 1;
      return o.heightMm * k + 8;
    }

    case "infoBox": {
      const satir = satirlariBol(doc, b.text, genislikMm - KUTU_IC_BOSLUK * 2 - 2);
      return 5.5 + satir.length * SATIR_MM + KUTU_IC_BOSLUK + 3;
    }

    case "answerLines":
      return b.count * 7 + 2;

    case "image": {
      const enBoy = Math.min(genislikMm, genislikMm);
      const h = enBoy / b.aspect;
      return Math.min(h, b.maxHeightMm ?? 60) + 3;
    }
  }
}

/* ------------------------------------------------------------------ */
/* ÇİZ                                                                 */
/* ------------------------------------------------------------------ */

/** Kalın/italik parçaları ayrı ayrı yazarak biçimi korur. */
function runlariYaz(
  doc: jsPDF,
  runs: Run[],
  x: number,
  y: number,
  genislikMm: number
): number {
  // Basit akış: her run kendi stiliyle, satır sonunda alt satıra geçilir
  let imlecX = x;
  let imlecY = y;
  const satirSonu = x + genislikMm;

  for (const r of runs) {
    const parcalar = r.text.split(/(\s+|\n)/).filter((p) => p !== "");
    for (const p of parcalar) {
      if (p === "\n") {
        imlecX = x;
        imlecY += SATIR_MM;
        continue;
      }
      govdeYaz(doc, r.sup || r.sub ? GOVDE_PT * 0.75 : GOVDE_PT, r.bold);
      if (r.italic) {
        // jsPDF'te italik ayrı yüz gerektirir; yoksa normal yazılır
        try {
          doc.setFont(doc.getFont().fontName, "italic");
        } catch {
          /* yüz yoksa normal kalır */
        }
      }
      const w = doc.getTextWidth(p);
      if (imlecX + w > satirSonu && p.trim()) {
        imlecX = x;
        imlecY += SATIR_MM;
      }
      const yOfs = r.sup ? -1.3 : r.sub ? 0.8 : 0;
      doc.text(p, imlecX, imlecY + yOfs);
      imlecX += w;
    }
  }
  return imlecY + SATIR_MM;
}

export function blokCiz(
  doc: jsPDF,
  b: DocBlock,
  x: number,
  y: number,
  genislikMm: number
): number {
  doc.setTextColor("#374151");

  switch (b.kind) {
    case "spacer":
      return y + b.heightMm;

    case "sectionTitle": {
      doc.setFillColor(KURUMSAL.lacivert);
      doc.roundedRect(x, y, genislikMm, BASLIK_H_MM, 1.8, 1.8, "F");
      doc.setTextColor(KURUMSAL.beyaz);
      govdeYaz(doc, 9, true);
      doc.text(b.text, x + 3, y + 4.8);
      doc.setTextColor("#374151");
      return y + BASLIK_H_MM + 3;
    }

    case "paragraph": {
      const son = runlariYaz(doc, b.runs, x, y + 3.2, genislikMm);
      return son + 1;
    }

    case "list": {
      let imlecY = y + 3.2;
      b.items.forEach((it, i) => {
        govdeYaz(doc);
        doc.setTextColor(KURUMSAL.lacivert);
        doc.text(b.ordered ? `${i + 1}.` : "•", x, imlecY);
        doc.setTextColor("#374151");
        imlecY = runlariYaz(doc, it, x + 5, imlecY, genislikMm - 5);
      });
      return imlecY + 1;
    }

    case "question": {
      doc.setFillColor("#dce9f6");
      doc.roundedRect(x, y, genislikMm, SORU_BASLIK_H_MM, 1.6, 1.6, "F");
      doc.setTextColor(KURUMSAL.lacivert);
      govdeYaz(doc, 8, true);
      doc.text(
        b.no != null ? `SORU ${String(b.no).padStart(2, "0")}` : "SORU",
        x + 3,
        y + 4.1
      );
      doc.setTextColor("#374151");

      let imlecY = runlariYaz(doc, b.stem, x + 1, y + SORU_BASLIK_H_MM + 4.5, genislikMm - 6);
      imlecY += 1;

      for (const o of b.options) {
        govdeYaz(doc, GOVDE_PT, true);
        doc.setTextColor(KURUMSAL.lacivert);
        doc.text(`${o.label})`, x + 3, imlecY);
        doc.setTextColor("#374151");
        imlecY = runlariYaz(doc, o.runs, x + 9, imlecY, genislikMm - 10);
      }
      return imlecY + 2;
    }

    case "table": {
      const satirH = 6;
      const sutunSayisi = Math.max(...b.rows.map((r) => r.length));
      const sutunW = genislikMm / sutunSayisi;
      doc.setDrawColor("#cbd5e1");
      doc.setLineWidth(0.25);
      b.rows.forEach((satir, i) => {
        const sy = y + i * satirH;
        const basliktir = b.baslikSatiri !== false && i === 0;
        if (basliktir) {
          doc.setFillColor("#dce9f6");
          doc.rect(x, sy, genislikMm, satirH, "F");
        }
        for (let j = 0; j < sutunSayisi; j++) {
          const cx = x + j * sutunW;
          doc.rect(cx, sy, sutunW, satirH, "S");
          const hucre = satir[j] ?? "";
          if (hucre) {
            govdeYaz(doc, 7.5, basliktir);
            doc.setTextColor(basliktir ? KURUMSAL.lacivert : "#374151");
            const kisa = doc.splitTextToSize(hucre, sutunW - 3)[0] as string;
            doc.text(kisa, cx + 1.5, sy + 4);
          }
        }
      });
      doc.setTextColor("#374151");
      return y + b.rows.length * satirH + 2;
    }

    case "formula": {
      const o = formulaSizeMm(b.render, 13);
      let w = o.widthMm;
      let h = o.heightMm;
      const maxW = genislikMm - 8;
      if (w > maxW) {
        const k = maxW / w;
        w *= k;
        h *= k;
      }
      const kutuH = h + 8;
      doc.setFillColor("#edf5fb");
      doc.roundedRect(x, y, genislikMm, kutuH, 2, 2, "F");
      doc.addImage(b.render.dataUrl, "PNG", x + (genislikMm - w) / 2, y + 4, w, h);
      return y + kutuH + 2;
    }

    case "infoBox": {
      const bilgi = b.tone === "bilgi";
      const zemin = bilgi ? "#f1f8f4" : "#fff1f1";
      const serit = bilgi ? "#2e9e63" : KURUMSAL.kirmizi;
      const baslikRenk = bilgi ? "#1f7a4a" : "#bd2539";
      const satir = satirlariBol(doc, b.text, genislikMm - KUTU_IC_BOSLUK * 2 - 2);
      const h = 5.5 + satir.length * SATIR_MM + KUTU_IC_BOSLUK;

      doc.setFillColor(zemin);
      doc.setDrawColor(serit);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, genislikMm, h, 2, 2, "FD");
      doc.setFillColor(serit);
      doc.rect(x, y + 1, 1, h - 2, "F");

      doc.setTextColor(baslikRenk);
      govdeYaz(doc, 8, true);
      doc.text(b.title, x + KUTU_IC_BOSLUK + 1, y + 4.6);
      doc.setTextColor("#374151");
      govdeYaz(doc);
      satir.forEach((l, i) =>
        doc.text(l, x + KUTU_IC_BOSLUK + 1, y + 9.2 + i * SATIR_MM)
      );
      return y + h + 3;
    }

    case "answerLines": {
      doc.setDrawColor("#d5dfe9");
      doc.setLineWidth(0.25);
      for (let i = 0; i < b.count; i++) {
        const ly = y + 4 + i * 7;
        doc.line(x, ly, x + genislikMm, ly);
      }
      return y + b.count * 7 + 2;
    }

    case "image": {
      let w = genislikMm;
      let h = w / b.aspect;
      const maxH = b.maxHeightMm ?? 60;
      if (h > maxH) {
        h = maxH;
        w = h * b.aspect;
      }
      doc.addImage(b.dataUrl, "PNG", x + (genislikMm - w) / 2, y, w, h);
      return y + h + 3;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Yardımcı: blok listesini sütuna akıt                                */
/* ------------------------------------------------------------------ */

export type Yerlesim = {
  /** Sütuna sığan bloklar ve çizim y değerleri */
  yerlesen: { blok: DocBlock; y: number }[];
  /** Sığmayan, bir sonraki sütuna/sayfaya kalan bloklar */
  kalan: DocBlock[];
};

/**
 * Blokları tek bir sütuna sığdığı kadar yerleştirir.
 * Bölünmez bütünlük: soru kökü ve şıkları, formül ve kutu asla
 * ikiye ayrılmaz — spec 7'deki "soru kökü ve seçenekler bölünmesin"
 * kuralı bu yüzden blok düzeyinde uygulanıyor.
 */
export function sutunaYerlestir(
  doc: jsPDF,
  bloklar: DocBlock[],
  genislikMm: number,
  baslangicY: number,
  altSinirY: number
): Yerlesim {
  const yerlesen: { blok: DocBlock; y: number }[] = [];
  let y = baslangicY;
  let i = 0;
  for (; i < bloklar.length; i++) {
    const b = bloklar[i];
    const h = blokYuksekligi(doc, b, genislikMm);
    if (y + h > altSinirY) break;
    yerlesen.push({ blok: b, y });
    y += h;
  }
  return { yerlesen, kalan: bloklar.slice(i) };
}
