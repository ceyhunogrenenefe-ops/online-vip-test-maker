import { jsPDF } from "jspdf";
import { registerTurkishFont, setTurkishFont } from "./pdf-font";
import {
  KURUMSAL,
  corporateFooterHeight,
  corporateHeaderHeight,
  drawCorporateFooterOnAllPages,
  drawCorporateHeader,
  drawFoyFiligran,
} from "./pdf-corporate";
import { blokCiz, blokYuksekligi, gorselOlcu, type DocBlock } from "./pdf-blocks";
import { baskiIcinJpeg, gorselButcesi } from "./pdf-gorsel";
import { foyYerlesimPlani, planBlokSayisi, type FoySayfaPlani } from "./foy-yerlesim";
import { cachedBrandKit, loadBrandKit } from "./brand-kit";
import { cevapAnahtariSatirlari, foyBaskiBloklari, type BaskiEk } from "./foy-baski";
import { numaraliSoruMu } from "./foy-icerik";
import type { FoyTasarim } from "./foy-kunye";
import { drawPageWatermark } from "./pdf-watermark";
import type { PaperSettings } from "@/types";

/**
 * Kurumsal föy belge birleştiricisi — Aşama 5 (otomatik yerleşim).
 *
 * Bu mantık /bilesen-deneme sayfasının içine gömülüydü. Üretim föy
 * editörü ile demo aynı yerleşimi kullanmazsa, öğretmenin ekranda
 * onayladığı föy ile basılan föy ayrışır; bu yüzden tek kaynağa taşındı.
 *
 * Yerleşim kararları foy-yerlesim.ts'te (saf, Node ile sınanıyor);
 * burada yalnızca ölçme ve çizim var.
 */

export type FoyTeshis = {
  verilen: number;
  cizilen: number;
  /** Sütuna sığmadığı halde sığdırılmadan çizilen blokların indeksleri */
  zorlanan: number[];
  /** Sayfa sınırı dolduğu için hiç çizilemeyen blokların indeksleri */
  dusen: number[];
  sayfa: number;
};

export type FoyPdfSonuc = { doc: jsPDF; teshis: FoyTeshis };

export const FOY_OLCU = {
  kenar: 12,
  sutunBoslugu: 8,
  maksSayfa: 40,
} as const;

export function foySutunGenisligi(
  pageW: number,
  sutun = 2,
  kenar: number = FOY_OLCU.kenar,
  bosluk: number = FOY_OLCU.sutunBoslugu
): number {
  const n = Math.max(1, sutun);
  if (n === 1) return pageW - kenar * 2;
  return (pageW - kenar * 2 - bosluk * (n - 1)) / n;
}

export type FoyCiktiSecenegi = {
  sutunSayisi?: 1 | 2;
  yon?: "portrait" | "landscape";
  kenarMm?: number;
  soruAraligiMm?: number;
  cozum?: FoyTasarim["cozum"];
  cozumSatir?: number;
  akilliYerlesim?: boolean;
  /** Bloklarla aynı sırada. Yalnızca soru bloklarının satırı ve karekodu okunur. */
  baskiEk?: BaskiEk[];
  filigran?: boolean;
  /** true ise kurum logosu (yüklüyse) kullanılır; logo yoksa metin filigranı kalır. */
  filigranLogo?: boolean;
  surum?: "ogrenci" | "ogretmen";
  cevaplar?: { blok: DocBlock; cevap?: string; cozum?: string; puan?: number }[];
};

/** Teşhiste bildirilecek bir sorun var mı */
export function foyTeshisSorunlu(t: FoyTeshis): boolean {
  return t.dusen.length > 0 || t.zorlanan.length > 0 || t.cizilen !== t.verilen;
}

/** Öğretmene gösterilecek tek satır uyarı; sorun yoksa null */
export function foyTeshisMesaji(t: FoyTeshis): string | null {
  const parcalar: string[] = [];
  if (t.dusen.length) {
    parcalar.push(
      `${t.dusen.length} blok sayfaya sığmadı ve PDF'e GİRMEDİ (sıra: ${t.dusen
        .map((i) => i + 1)
        .join(", ")})`
    );
  }
  if (t.zorlanan.length) {
    parcalar.push(
      `${t.zorlanan.length} blok bir sütundan uzun olduğu için taşarak çizildi (sıra: ${t.zorlanan
        .map((i) => i + 1)
        .join(", ")})`
    );
  }
  return parcalar.length ? parcalar.join(" · ") : null;
}

async function foyGorselleriniSigdir(
  sayfalar: FoySayfaPlani[],
  sutunW: number,
  tamW: number
): Promise<Map<DocBlock, DocBlock>> {
  const hedefler: { blok: Extract<DocBlock, { kind: "image" }>; w: number; h: number }[] = [];
  for (const sayfa of sayfalar) {
    for (const sutun of sayfa.sutunlar) {
      for (const yerlesen of sutun) {
        if (yerlesen.blok.kind !== "image") continue;
        const olcu = gorselOlcu(yerlesen.blok, yerlesen.tamGenislik ? tamW : sutunW);
        hedefler.push({ blok: yerlesen.blok, w: olcu.w, h: olcu.h });
      }
    }
  }
  const butce = gorselButcesi(hedefler.length);
  const harita = new Map<DocBlock, DocBlock>();
  const onbellek = new Map<string, string>();
  for (const hedef of hedefler) {
    const anahtar = `${hedef.w.toFixed(1)}|${hedef.h.toFixed(1)}|${hedef.blok.dataUrl}`;
    let url = onbellek.get(anahtar);
    if (!url) {
      const baski = await baskiIcinJpeg(hedef.blok.dataUrl, hedef.w, hedef.h, butce);
      url = baski.bicim === "JPEG" ? baski.url : hedef.blok.dataUrl;
      onbellek.set(anahtar, url);
    }
    if (url !== hedef.blok.dataUrl) harita.set(hedef.blok, { ...hedef.blok, dataUrl: url });
  }
  return harita;
}

/**
 * Blokları iki sütuna ve gerektiği kadar sayfaya akıtır.
 * Alt bilgi, boş sayfalar değerlendirildikten sonra tüm sayfalara yazılır.
 */
export async function foyPdfOlustur(
  bloklar: DocBlock[],
  settings: PaperSettings,
  secenek: FoyCiktiSecenegi = {}
): Promise<FoyPdfSonuc> {
  await loadBrandKit();
  const sutunSayisi = secenek.sutunSayisi === 1 ? 1 : 2;
  const kenar = secenek.kenarMm ?? FOY_OLCU.kenar;
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: secenek.yon === "landscape" ? "landscape" : "portrait",
  });
  await registerTurkishFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sutunW = foySutunGenisligi(pageW, sutunSayisi, kenar, FOY_OLCU.sutunBoslugu);
  const ustY = corporateHeaderHeight(settings);
  const altSinir = pageH - kenar - corporateFooterHeight();
  const aralik = Math.max(0, secenek.soruAraligiMm ?? 0);
  const baski = foyBaskiBloklari(
    bloklar,
    {
      cozum: secenek.cozum ?? "yok",
      cozumSatir: secenek.cozumSatir ?? 4,
    },
    secenek.baskiEk
  );

  const tamW = pageW - kenar * 2;
  const plan = foyYerlesimPlani(
    baski,
    (b, tam) => blokYuksekligi(doc, b, tam ? tamW : sutunW) + (numaraliSoruMu(b) ? aralik : 0),
    { ustY, altSinir, maksSayfa: FOY_OLCU.maksSayfa, sutunSayisi, akilli: secenek.akilliYerlesim !== false }
  );

  const logo = secenek.filigranLogo ? cachedBrandKit().logoDataUrl : undefined;
  const sikisikGorsel = await foyGorselleriniSigdir(plan.sayfalar, sutunW, tamW);

  plan.sayfalar.forEach((sayfa, si) => {
    if (si > 0) doc.addPage();
    drawCorporateHeader(doc, settings, pageW, kenar);
    if (secenek.filigran && !logo) drawFoyFiligran(doc, pageW, pageH);

    if (sutunSayisi > 1) {
      doc.setDrawColor(KURUMSAL.maviCizgi);
      doc.setLineWidth(0.3);
      const orta = kenar + sutunW + FOY_OLCU.sutunBoslugu / 2;
      const genisler = sayfa.sutunlar
        .flat()
        .filter((v) => v.tamGenislik)
        .map((v) => ({ y: v.y, alt: v.y + (v.yukseklikMm ?? 0) }))
        .sort((a, b) => a.y - b.y);
      let cizgiY = ustY;
      for (const g of genisler) {
        if (g.y - cizgiY > 1) doc.line(orta, cizgiY, orta, g.y);
        cizgiY = Math.max(cizgiY, g.alt);
      }
      if (altSinir - cizgiY > 1) doc.line(orta, cizgiY, orta, altSinir);
    }

    sayfa.sutunlar.forEach((sutun, ci) => {
      const x = kenar + ci * (sutunW + FOY_OLCU.sutunBoslugu);
      for (const yerlesen of sutun) {
        const genis = yerlesen.tamGenislik === true;
        blokCiz(
          doc,
          sikisikGorsel.get(yerlesen.blok) ?? yerlesen.blok,
          genis ? kenar : x,
          yerlesen.y,
          genis ? tamW : sutunW
        );
      }
    });
  });

  // Hiç blok yoksa bile tek sayfalık boş föy üretilir: başlık ve alt
  // bilgi öğretmene şablonun doğru kurulduğunu gösterir.
  if (plan.sayfalar.length === 0) {
    drawCorporateHeader(doc, settings, pageW, kenar);
    if (secenek.filigran && !logo) drawFoyFiligran(doc, pageW, pageH);
  }

  if (secenek.filigran && logo) {
    const toplam = doc.getNumberOfPages();
    for (let p = 1; p <= toplam; p++) {
      doc.setPage(p);
      await drawPageWatermark(
        doc,
        {
          ...settings,
          watermark: true,
          watermarkType: "logo",
          watermarkLogoImage: logo,
          watermarkOpacity: 0.08,
          watermarkLogoScale: 42,
        },
        pageW,
        pageH,
        { pageNumber: p, margin: kenar, contentTop: ustY, contentBottom: altSinir }
      );
    }
  }

  if (secenek.surum === "ogretmen") {
    cevapSayfasiCiz(doc, settings, secenek.cevaplar ?? [], kenar);
  }

  drawCorporateFooterOnAllPages(doc, settings, pageW, pageH, kenar);

  return {
    doc,
    teshis: {
      verilen: bloklar.length,
      cizilen: planBlokSayisi(plan),
      zorlanan: plan.zorlanan,
      dusen: plan.dusen,
      sayfa: Math.max(1, doc.getNumberOfPages()),
    },
  };
}

/** Öğretmen sürümü. Cevabı olmayan soruya cevap yazılmaz. */
function cevapSayfasiCiz(
  doc: jsPDF,
  settings: PaperSettings,
  ogeler: { blok: DocBlock; cevap?: string; cozum?: string; puan?: number }[],
  kenar: number
) {
  const satirlar = cevapAnahtariSatirlari(ogeler);
  if (!satirlar.length) return;
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  drawCorporateHeader(doc, { ...settings, topicTitle: "CEVAP ANAHTARI" }, pageW, kenar);
  let y = corporateHeaderHeight({ ...settings, topicTitle: "CEVAP ANAHTARI" });
  const pageH = doc.internal.pageSize.getHeight();
  const alt = pageH - kenar - corporateFooterHeight();
    setTurkishFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor("#1e293b");
  for (const s of satirlar) {
    const parcalar = [
      `Soru ${String(s.no).padStart(2, "0")}: ${s.cevap}`,
      s.puan ? `Puan: ${s.puan}` : "",
      s.cozum ? `Çözüm: ${s.cozum}` : "",
    ].filter(Boolean);
    const satirlarMetin = doc.splitTextToSize(parcalar.join("  ·  "), pageW - kenar * 2) as string[];
    const h = satirlarMetin.length * 4.4 + 2;
    if (y + h > alt) {
      doc.addPage();
      drawCorporateHeader(doc, { ...settings, topicTitle: "CEVAP ANAHTARI" }, pageW, kenar);
      y = corporateHeaderHeight({ ...settings, topicTitle: "CEVAP ANAHTARI" });
      setTurkishFont(doc, "normal");
      doc.setFontSize(9);
      doc.setTextColor("#1e293b");
    }
    doc.text(satirlarMetin, kenar, y + 4);
    y += h;
  }
}

