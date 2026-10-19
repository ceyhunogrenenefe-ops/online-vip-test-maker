import type { jsPDF } from "jspdf";
import { setTurkishFont } from "./pdf-font";
import type { PaperSettings } from "@/types";
import { cachedBrandKit, imageFormatOf } from "./brand-kit";

/**
 * Online VIP Dershane kurumsal foy sablonu.
 *
 * Olculer docs/sablon-onizleme.html ile ayni; orada A4 (210x297 mm) uzerinde
 * mm biriminde dogrulandi. Burada da mm kullaniliyor (jsPDF "mm" birimiyle
 * olusturuluyor), boylece onizleme ile ciktinin yerlesimi ortusuyor.
 *
 * Mevcut drawHeader'a dokunulmadi: bu sablon yalnizca
 * settings.corporateTemplate acikken devreye girer.
 */

export const KURUMSAL = {
  lacivert: "#173b70",
  lacivertKoyu: "#0f2a52",
  kirmizi: "#d72d42",
  maviAcik: "#eef4fa",
  maviCizgi: "#d7e3f0",
  gri: "#64748b",
  beyaz: "#ffffff",
} as const;

/** Ust serit + logo/baslik blogu + kirmizi ayirici */
const SERIT_LACIVERT_MM = 6;
const SERIT_KIRMIZI_MM = 1.6;
const LOGO_W_MM = 26;
const LOGO_H_MM = 19;
const ROZET_W_MM = 36;
const ROZET_H_MM = 19;
const BLOK_UST_MM = 10;
const KONU_BANDI_H_MM = 9;
const ALT_BILGI_H_MM = 18;

export function konuBandiVar(settings: PaperSettings): boolean {
  return Boolean(settings.topicTitle?.trim());
}

/** Icerigin baslayabilecegi ilk y (mm) */
export function corporateHeaderHeight(settings: PaperSettings): number {
  const ayiriciAlti = BLOK_UST_MM + LOGO_H_MM + 3.5; // kirmizi cizgi hizasi
  if (!konuBandiVar(settings)) return ayiriciAlti + 4;
  return ayiriciAlti + 3.5 + KONU_BANDI_H_MM + 4;
}

/** Alt bilgi icin ayrilan yukseklik (mm) */
export function corporateFooterHeight(): number {
  return ALT_BILGI_H_MM;
}

/** Turkce buyuk harf: varsayilan toUpperCase() "i" harfini "I" yapar (KUVVETI). */
function buyukHarf(metin: string): string {
  return metin.toLocaleUpperCase("tr-TR");
}

function metniSigdir(
  doc: jsPDF,
  metin: string,
  maxGenislikMm: number,
  baslangicPt: number,
  minPt = 7
): number {
  let pt = baslangicPt;
  doc.setFontSize(pt);
  while (pt > minPt && doc.getTextWidth(metin) > maxGenislikMm) {
    pt -= 0.5;
    doc.setFontSize(pt);
  }
  return pt;
}

export function drawCorporateHeader(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  margin: number
) {
  // --- Ust serit ---
  doc.setFillColor(KURUMSAL.lacivert);
  doc.rect(0, 0, pageW, SERIT_LACIVERT_MM, "F");
  doc.setFillColor(KURUMSAL.kirmizi);
  doc.rect(0, SERIT_LACIVERT_MM, pageW, SERIT_KIRMIZI_MM, "F");

  const y = BLOK_UST_MM;

  // --- Logo ---
  // Merkezden (kocluk platformu) okunan kurumsal logo; yoksa lacivert kutu.
  const marka = cachedBrandKit();
  let logoCizildi = false;
  if (marka.logoDataUrl) {
    try {
      const bicim = imageFormatOf(marka.logoDataUrl);
      const olcu = doc.getImageProperties(marka.logoDataUrl);
      const oran = olcu.width / olcu.height;
      // Kutuya sigdir, orani koru, dikeyde ortala
      let w = LOGO_W_MM;
      let h = w / oran;
      if (h > LOGO_H_MM) {
        h = LOGO_H_MM;
        w = h * oran;
      }
      doc.addImage(marka.logoDataUrl, bicim, margin, y + (LOGO_H_MM - h) / 2, w, h);
      logoCizildi = true;
    } catch {
      logoCizildi = false;
    }
  }
  if (!logoCizildi) {
    doc.setFillColor(KURUMSAL.lacivert);
    doc.roundedRect(margin, y, LOGO_W_MM, LOGO_H_MM, 2.2, 2.2, "F");
    doc.setTextColor(KURUMSAL.beyaz);
    setTurkishFont(doc, "bold");
    doc.setFontSize(19);
    doc.text("VIP", margin + LOGO_W_MM / 2, y + 11.2, { align: "center" });
    setTurkishFont(doc, "normal");
    doc.setFontSize(5.4);
    doc.text("ONLINE", margin + LOGO_W_MM / 2, y + 15.4, { align: "center" });
  }

  // --- Sinif / brans rozeti (sagda) ---
  const rozetMetinleri = [
    settings.classSection?.trim(),
    settings.subjectBranch?.trim(),
  ].filter(Boolean) as string[];
  const rozetVar = rozetMetinleri.length > 0;
  const rozetX = pageW - margin - ROZET_W_MM;
  if (rozetVar) {
    doc.setFillColor(KURUMSAL.maviAcik);
    doc.setDrawColor(KURUMSAL.maviCizgi);
    doc.setLineWidth(0.3);
    doc.roundedRect(rozetX, y, ROZET_W_MM, ROZET_H_MM, 2.2, 2.2, "FD");
    doc.setTextColor(KURUMSAL.lacivert);
    const ortaX = rozetX + ROZET_W_MM / 2;
    if (rozetMetinleri.length === 2) {
      setTurkishFont(doc, "bold");
      metniSigdir(doc, rozetMetinleri[0], ROZET_W_MM - 4, 9);
      doc.text(rozetMetinleri[0], ortaX, y + 8.2, { align: "center" });
      setTurkishFont(doc, "normal");
      metniSigdir(doc, rozetMetinleri[1], ROZET_W_MM - 4, 8);
      doc.text(rozetMetinleri[1], ortaX, y + 13.6, { align: "center" });
    } else {
      setTurkishFont(doc, "bold");
      metniSigdir(doc, rozetMetinleri[0], ROZET_W_MM - 4, 9);
      doc.text(rozetMetinleri[0], ortaX, y + 11.4, { align: "center" });
    }
  }

  // --- Kurum adi + dokuman turu ---
  const metinX = margin + LOGO_W_MM + 5;
  const metinMaxW = (rozetVar ? rozetX - 5 : pageW - margin) - metinX;
  doc.setTextColor(KURUMSAL.lacivert);
  setTurkishFont(doc, "bold");
  const kurum = buyukHarf(settings.schoolName || marka.institutionName);
  const yil = settings.academicYear?.trim();
  const turMetni = (settings.documentKind || settings.testName || "").trim();
  if (yil) {
    // Üç satır logo kutusunun (19 mm) içinde kalır. Yıl yoksa eski iki satır aynen durur.
    metniSigdir(doc, kurum, metinMaxW, 11, 8);
    doc.text(kurum, metinX, y + 6.2);
    setTurkishFont(doc, "normal");
    doc.setTextColor(KURUMSAL.gri);
    const yilSatiri = buyukHarf(
      yil.includes("EĞİTİM") ? yil : `${yil} EĞİTİM ÖĞRETİM YILI`
    );
    metniSigdir(doc, yilSatiri, metinMaxW, 7.2, 6);
    doc.text(yilSatiri, metinX, y + 10.8);
    if (turMetni) {
      doc.setTextColor(KURUMSAL.lacivert);
      setTurkishFont(doc, "bold");
      metniSigdir(doc, buyukHarf(turMetni), metinMaxW, 7.4, 6);
      doc.text(buyukHarf(turMetni), metinX, y + 15.6);
    }
  } else {
    metniSigdir(doc, kurum, metinMaxW, 13, 8);
    doc.text(kurum, metinX, y + 8);
    if (turMetni) {
      setTurkishFont(doc, "normal");
      doc.setTextColor(KURUMSAL.gri);
      metniSigdir(doc, buyukHarf(turMetni), metinMaxW, 8.5, 6);
      doc.text(buyukHarf(turMetni), metinX, y + 14.2);
    }
  }

  // --- Kirmizi ayirici ---
  const ayiriciY = y + LOGO_H_MM + 3.5;
  doc.setDrawColor(KURUMSAL.kirmizi);
  doc.setLineWidth(0.5);
  doc.line(margin, ayiriciY, pageW - margin, ayiriciY);

  // --- Konu bandi ---
  if (konuBandiVar(settings)) {
    const bandY = ayiriciY + 3.5;
    const bandW = pageW - margin * 2;
    doc.setFillColor(KURUMSAL.maviAcik);
    doc.roundedRect(margin, bandY, bandW, KONU_BANDI_H_MM, 1.8, 1.8, "F");
    doc.setTextColor(KURUMSAL.lacivert);
    setTurkishFont(doc, "bold");
    const konu = buyukHarf(settings.topicTitle!.trim());
    metniSigdir(doc, konu, bandW - 8, 11, 7);
    doc.text(konu, pageW / 2, bandY + KONU_BANDI_H_MM / 2 + 1.5, {
      align: "center",
    });
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

export function drawCorporateFooter(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number,
  margin: number,
  sayfaNo: number
) {
  const cizgiY = pageH - ALT_BILGI_H_MM + 3;
  doc.setDrawColor(KURUMSAL.kirmizi);
  doc.setLineWidth(0.5);
  doc.line(margin, cizgiY, pageW - margin, cizgiY);

  const yaziY = cizgiY + 5.2;
  setTurkishFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(KURUMSAL.gri);

  const slogan = (settings.footerSlogan || cachedBrandKit().slogan || "").trim();
  if (slogan) doc.text(slogan, margin, yaziY);

  const marka = (settings.schoolName || "Online VIP Dershane").trim();
  doc.text(marka, pageW / 2, yaziY, { align: "center" });

  const ek: string[] = [];
  if (settings.includeTeacherName && settings.teacherName?.trim()) {
    ek.push(settings.teacherName.trim());
  }
  if (settings.website?.trim()) ek.push(settings.website.trim());
  if (ek.length) {
    doc.setFontSize(6.5);
    setTurkishFont(doc, "normal");
    const ekMetin = ek.join("  ·  ");
    const maxW = pageW - margin * 2 - 18;
    metniSigdir(doc, ekMetin, maxW, 6.5, 5.5);
    doc.text(ekMetin, margin, yaziY + 4.2);
  }

  // Sayfa numarasi rozeti
  const no = String(sayfaNo).padStart(2, "0");
  doc.setFontSize(8.5);
  setTurkishFont(doc, "bold");
  const noW = doc.getTextWidth(no) + 5;
  const noH = 6;
  const noX = pageW - margin - noW;
  const noY = yaziY - 4.3;
  doc.setFillColor(KURUMSAL.maviAcik);
  doc.roundedRect(noX, noY, noW, noH, 1.2, 1.2, "F");
  doc.setTextColor(KURUMSAL.lacivert);
  doc.text(no, noX + noW / 2, noY + 4.2, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

/**
 * Sayfa ortasında tek satırlık açık filigran.
 * Mevcut çok kopyalı filigran soru okunurluğunu düşürdüğü için föyde kullanılmaz.
 * jsPDF sürümünde GState varsa gerçek saydamlık, yoksa açık gri kullanılır.
 */
export function drawFoyFiligran(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  metin = "ONLINE VIP DERSHANE"
) {
  const gState = (doc as jsPDF & { GState?: (opts: { opacity: number }) => unknown }).GState;
  const saydam = typeof gState === "function";
  if (saydam) doc.setGState(gState({ opacity: 0.07 }) as never);
  doc.setTextColor(saydam ? KURUMSAL.lacivert : "#d5dee8");
  setTurkishFont(doc, "bold");
  doc.setFontSize(20);
  doc.text(metin, pageW / 2, pageH / 2, { align: "center", angle: 32 });
  if (saydam) doc.setGState(gState({ opacity: 1 }) as never);
  doc.setTextColor(0, 0, 0);
}

/** Tum sayfalara alt bilgi yazar — sayfa sayisi ancak sonda bellidir. */
export function drawCorporateFooterOnAllPages(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number,
  margin: number
) {
  const toplam = doc.getNumberOfPages();
  for (let i = 1; i <= toplam; i++) {
    doc.setPage(i);
    drawCorporateFooter(doc, settings, pageW, pageH, margin, i);
  }
}
