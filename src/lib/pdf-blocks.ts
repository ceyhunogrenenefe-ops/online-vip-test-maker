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

/** Kırpılmış veya yüklenmiş görselin föydeki işi. */
export type GorselRol = "soru" | "aciklama" | "cozum";

export type DocBlock =
  | { kind: "sectionTitle"; text: string; tamGenislik?: boolean }
  | { kind: "paragraph"; runs: Run[]; tamGenislik?: boolean }
  | { kind: "list"; ordered: boolean; items: Run[][]; tamGenislik?: boolean }
  | { kind: "question"; no?: number; stem: Run[]; options: { label: string; runs: Run[] }[]; tamGenislik?: boolean; kazanim?: string; videoQr?: string }
  | { kind: "table"; rows: string[][]; baslikSatiri?: boolean; tamGenislik?: boolean }
  | { kind: "formula"; render: RenderedFormula; latex?: string; tamGenislik?: boolean }
  | { kind: "infoBox"; tone: "bilgi" | "dikkat"; title: string; text: string; tamGenislik?: boolean }
  | { kind: "answerLines"; count: number; style?: "lines" | "grid" | "blank"; tamGenislik?: boolean }
  | { kind: "qr"; dataUrl: string; url: string; tamGenislik?: boolean }
  | { kind: "image"; dataUrl: string; aspect: number; maxHeightMm?: number; rol?: GorselRol; no?: number; tamGenislik?: boolean; kazanim?: string; videoQr?: string }
  | { kind: "spacer"; heightMm: number; tamGenislik?: boolean }
  /** Öğretmenin bilinçli kestiği akış. Yerleşim bunları içerik sanmaz. */
  | { kind: "pageBreak"; tamGenislik?: boolean }
  | { kind: "columnBreak"; tamGenislik?: boolean };

const GOVDE_PT = 8.5;
const SATIR_MM = 4.2;
const BASLIK_H_MM = 7;
const SORU_BASLIK_H_MM = 6;
const KUTU_IC_BOSLUK = 3.2;
/** Soru numarasının altındaki video karekodu. Ayrı satır açmaz. */
const VIDEO_QR_MM = 16;
const VIDEO_QR_BOSLUK = 1.5;

/** Karekod sol şeritte durunca görselin kalan genişliği. */
export function gorselAlanGenisligi(
  b: Extract<DocBlock, { kind: "image" }>,
  genislikMm: number
): number {
  if (!b.videoQr) return genislikMm;
  return Math.max(24, genislikMm - VIDEO_QR_MM - VIDEO_QR_BOSLUK);
}

function gorselBaslik(b: Extract<DocBlock, { kind: "image" }>): string | null {
  if (b.rol === "aciklama") return "AÇIKLAMA";
  if (b.rol === "cozum") return "ÇÖZÜM";
  if (b.rol === "soru") return b.no != null ? String(b.no) : "Soru";
  return null;
}

export function gorselOlcu(b: Extract<DocBlock, { kind: "image" }>, genislikMm: number) {
  let w = genislikMm;
  let h = w / (b.aspect || 1);
  const maxH = b.maxHeightMm ?? 60;
  if (h > maxH) {
    h = maxH;
    w = Math.min(genislikMm, h * b.aspect);
  }
  return { w, h, baslik: gorselBaslik(b) };
}

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

/** Kazanım sorunun üstünde basılır; öğrenci yapıştırılan soruda da bunu görür. */
function kazanimSatirlari(doc: jsPDF, metin: string | undefined, genislikMm: number): string[] {
  const t = (metin || "").trim();
  if (!t) return [];
  return satirlariBol(doc, `Kazanım: ${t}`, Math.max(12, genislikMm - 4));
}

function kazanimYukseklik(satirlar: string[]): number {
  if (!satirlar.length) return 0;
  return 1.4 + satirlar.length * SATIR_MM + 1.6;
}

function kazanimCiz(
  doc: jsPDF,
  satirlar: string[],
  x: number,
  y: number,
  genislikMm: number
): number {
  if (!satirlar.length) return y;
  const h = kazanimYukseklik(satirlar) - 1.2;
  doc.setFillColor("#fff6e8");
  doc.roundedRect(x, y, genislikMm, h, 1.2, 1.2, "F");
  doc.setTextColor("#9a3412");
  govdeYaz(doc, 7.5, true);
  satirlar.forEach((l, i) => doc.text(l, x + 2, y + 3.6 + i * SATIR_MM));
  doc.setTextColor("#374151");
  return y + kazanimYukseklik(satirlar);
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
      const sol = b.videoQr ? VIDEO_QR_MM + VIDEO_QR_BOSLUK : 0;
      const kazanim = kazanimYukseklik(kazanimSatirlari(doc, b.kazanim, genislikMm));
      const kok = satirlariBol(doc, runlariDuzMetne(b.stem), Math.max(12, genislikMm - 6 - sol));
      let h = kazanim + SORU_BASLIK_H_MM + 2 + kok.length * SATIR_MM + 1.5;
      for (const o of b.options) {
        const satir = satirlariBol(doc, runlariDuzMetne(o.runs), Math.max(12, genislikMm - 10 - sol));
        h += Math.max(SATIR_MM, satir.length * SATIR_MM);
      }
      if (b.videoQr) h = Math.max(h, kazanim + SORU_BASLIK_H_MM + 1 + VIDEO_QR_MM + 2);
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
      return (b.style === "grid" ? 8 : 7) * b.count + 2;

    case "qr":
      return VIDEO_QR_MM + 2;

    case "pageBreak":
    case "columnBreak":
      return 0;

    case "image": {
      const olcu = gorselOlcu(b, gorselAlanGenisligi(b, genislikMm));
      const kazanimH =
        b.rol === "soru" ? kazanimYukseklik(kazanimSatirlari(doc, b.kazanim, genislikMm)) : 0;
      if (b.videoQr) {
        const solH = (olcu.baslik ? SORU_BASLIK_H_MM + 1 : 0) + VIDEO_QR_MM;
        return kazanimH + Math.max(solH, olcu.h) + 3;
      }
      return kazanimH + (olcu.baslik ? SORU_BASLIK_H_MM + 1.5 : 0) + olcu.h + 3;
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
      const ySoru = kazanimCiz(doc, kazanimSatirlari(doc, b.kazanim, genislikMm), x, y, genislikMm);
      doc.setFillColor("#dce9f6");
      doc.roundedRect(x, ySoru, genislikMm, SORU_BASLIK_H_MM, 1.6, 1.6, "F");
      doc.setTextColor(KURUMSAL.lacivert);
      govdeYaz(doc, 8, true);
      doc.text(
        b.no != null ? `SORU ${String(b.no).padStart(2, "0")}` : "SORU",
        x + 3,
        ySoru + 4.1
      );
      doc.setTextColor("#374151");

      const sol = b.videoQr ? VIDEO_QR_MM + VIDEO_QR_BOSLUK : 0;
      if (b.videoQr) {
        const bicim = b.videoQr.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(b.videoQr, bicim, x, ySoru + SORU_BASLIK_H_MM + 1, VIDEO_QR_MM, VIDEO_QR_MM);
      }

      let imlecY = runlariYaz(
        doc,
        b.stem,
        x + 1 + sol,
        ySoru + SORU_BASLIK_H_MM + 4.5,
        Math.max(12, genislikMm - 6 - sol)
      );
      imlecY += 1;

      for (const o of b.options) {
        govdeYaz(doc, GOVDE_PT, true);
        doc.setTextColor(KURUMSAL.lacivert);
        doc.text(`${o.label})`, x + 3 + sol, imlecY);
        doc.setTextColor("#374151");
        imlecY = runlariYaz(doc, o.runs, x + 9 + sol, imlecY, Math.max(12, genislikMm - 10 - sol));
      }
      const qrAlt = b.videoQr ? ySoru + SORU_BASLIK_H_MM + 1 + VIDEO_QR_MM : imlecY;
      return Math.max(imlecY, qrAlt) + 2;
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

    case "qr": {
      const kenar = Math.min(VIDEO_QR_MM, genislikMm);
      const bicim = b.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(b.dataUrl, bicim, x, y, kenar, kenar);
      return y + kenar + 2;
    }

    case "answerLines": {
      if (b.style === "blank") return y + b.count * 7 + 2;
      doc.setDrawColor("#d5dfe9");
      doc.setLineWidth(0.25);
      if (b.style === "grid") {
        const hucre = 6;
        const sutun = Math.max(1, Math.floor(genislikMm / hucre));
        for (let r = 0; r < b.count; r++) {
          for (let c = 0; c < sutun; c++) {
            doc.rect(x + c * hucre, y + 1 + r * 8, hucre, 7);
          }
        }
        return y + b.count * 8 + 2;
      }
      for (let i = 0; i < b.count; i++) {
        const ly = y + 4 + i * 7;
        doc.line(x, ly, x + genislikMm, ly);
      }
      return y + b.count * 7 + 2;
    }

    case "pageBreak":
    case "columnBreak":
      return y;

    case "image": {
      const alan = gorselAlanGenisligi(b, genislikMm);
      const olcu = gorselOlcu(b, alan);
      const yGorsel =
        b.rol === "soru"
          ? kazanimCiz(doc, kazanimSatirlari(doc, b.kazanim, genislikMm), x, y, genislikMm)
          : y;
      if (b.videoQr) {
        const sol = genislikMm - alan;
        if (olcu.baslik) {
          const kisa = b.rol === "soru";
          const etiketW = kisa ? 8 : Math.min(sol, 28);
          doc.setFillColor(KURUMSAL.lacivert);
          doc.roundedRect(x, yGorsel, etiketW, SORU_BASLIK_H_MM, 1, 1, "F");
          doc.setTextColor("#ffffff");
          govdeYaz(doc, kisa ? 11 : 8, true);
          doc.text(olcu.baslik, x + (kisa ? 2.4 : 1.6), yGorsel + 4.3);
          doc.setTextColor("#374151");
        }
        const qrY = yGorsel + (olcu.baslik ? SORU_BASLIK_H_MM + 1 : 0);
        const qrBicim = b.videoQr.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(b.videoQr, qrBicim, x, qrY, VIDEO_QR_MM, VIDEO_QR_MM);
        const bicim = b.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(b.dataUrl, bicim, x + sol + (alan - olcu.w) / 2, yGorsel, olcu.w, olcu.h);
        const solH = (olcu.baslik ? SORU_BASLIK_H_MM + 1 : 0) + VIDEO_QR_MM;
        return yGorsel + Math.max(solH, olcu.h) + 3;
      }
      let iy = yGorsel;
      if (olcu.baslik) {
        const kisa = b.rol === "soru";
        const etiketW = kisa ? 8 : Math.min(genislikMm, 28);
        doc.setFillColor(KURUMSAL.lacivert);
        doc.roundedRect(x, yGorsel, etiketW, SORU_BASLIK_H_MM, 1, 1, "F");
        doc.setTextColor("#ffffff");
        govdeYaz(doc, kisa ? 11 : 8, true);
        doc.text(olcu.baslik, x + (kisa ? 2.4 : 1.6), yGorsel + 4.3);
        doc.setTextColor("#374151");
        iy = yGorsel + SORU_BASLIK_H_MM + 1.5;
      }
      const bicim = b.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(b.dataUrl, bicim, x + (genislikMm - olcu.w) / 2, iy, olcu.w, olcu.h);
      return iy + olcu.h + 3;
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
    if (b.kind === "pageBreak" || b.kind === "columnBreak") {
      return { yerlesen, kalan: bloklar.slice(i) };
    }
    const h = blokYuksekligi(doc, b, genislikMm);
    if (y + h > altSinirY) break;
    yerlesen.push({ blok: b, y });
    y += h;
  }
  return { yerlesen, kalan: bloklar.slice(i) };
}
