import { jsPDF } from "jspdf";
import { registerTurkishFont } from "./pdf-font";
import {
  KURUMSAL,
  corporateFooterHeight,
  corporateHeaderHeight,
  drawCorporateFooterOnAllPages,
  drawCorporateHeader,
} from "./pdf-corporate";
import { blokCiz, blokYuksekligi, type DocBlock } from "./pdf-blocks";
import { foyYerlesimPlani, planBlokSayisi } from "./foy-yerlesim";
import { loadBrandKit } from "./brand-kit";
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

export function foySutunGenisligi(pageW: number): number {
  return (pageW - FOY_OLCU.kenar * 2 - FOY_OLCU.sutunBoslugu) / 2;
}

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

/**
 * Blokları iki sütuna ve gerektiği kadar sayfaya akıtır.
 * Alt bilgi, boş sayfalar değerlendirildikten sonra tüm sayfalara yazılır.
 */
export async function foyPdfOlustur(
  bloklar: DocBlock[],
  settings: PaperSettings
): Promise<FoyPdfSonuc> {
  await loadBrandKit();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await registerTurkishFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sutunW = foySutunGenisligi(pageW);
  const ustY = corporateHeaderHeight(settings);
  const altSinir = pageH - FOY_OLCU.kenar - corporateFooterHeight();

  const plan = foyYerlesimPlani(
    bloklar,
    (b) => blokYuksekligi(doc, b, sutunW),
    { ustY, altSinir, maksSayfa: FOY_OLCU.maksSayfa, sutunSayisi: 2 }
  );

  plan.sayfalar.forEach((sayfa, si) => {
    if (si > 0) doc.addPage();
    drawCorporateHeader(doc, settings, pageW, FOY_OLCU.kenar);

    // Sütunları ayıran orta çizgi
    doc.setDrawColor(KURUMSAL.maviCizgi);
    doc.setLineWidth(0.3);
    doc.line(pageW / 2, ustY, pageW / 2, altSinir);

    sayfa.sutunlar.forEach((sutun, ci) => {
      const x = FOY_OLCU.kenar + ci * (sutunW + FOY_OLCU.sutunBoslugu);
      for (const yerlesen of sutun) {
        blokCiz(doc, yerlesen.blok, x, yerlesen.y, sutunW);
      }
    });
  });

  // Hiç blok yoksa bile tek sayfalık boş föy üretilir: başlık ve alt
  // bilgi öğretmene şablonun doğru kurulduğunu gösterir.
  if (plan.sayfalar.length === 0) {
    drawCorporateHeader(doc, settings, pageW, FOY_OLCU.kenar);
  }

  drawCorporateFooterOnAllPages(doc, settings, pageW, pageH, FOY_OLCU.kenar);

  return {
    doc,
    teshis: {
      verilen: bloklar.length,
      cizilen: planBlokSayisi(plan),
      zorlanan: plan.zorlanan,
      dusen: plan.dusen,
      sayfa: Math.max(1, plan.sayfalar.length),
    },
  };
}
