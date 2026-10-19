/**
 * Föy baskı yardımcıları — çizim yok, Node ile sınanır.
 *
 * Çözüm alanı ve puan, öğretmenin kaydettiği blokların üzerine
 * yalnızca baskı listesinde eklenir. Otomatik yerleşim, öğretmenin
 * koyduğu sayfa sonunu silmez.
 */

import type { DocBlock } from "./pdf-blocks";
import type { FoyTasarim } from "./foy-kunye";

export type CozumStili = "lines" | "grid" | "blank";

export function cozumStili(cozum: FoyTasarim["cozum"]): CozumStili | null {
  if (cozum === "cizgili") return "lines";
  if (cozum === "kareli") return "grid";
  if (cozum === "bos") return "blank";
  return null;
}

/**
 * Soruların altına çözüm alanı ekler. Hemen ardından zaten cevap
 * satırı varsa ikinci kez eklemez. Sayfa sonu, sorunun çözümünden
 * sonraya kalır.
 */
export function foyBaskiBloklari(bloklar: DocBlock[], tasarim: Pick<FoyTasarim, "cozum" | "cozumSatir">): DocBlock[] {
  const stil = cozumStili(tasarim.cozum);
  if (!stil) return bloklar;
  const adet = Math.min(30, Math.max(1, Math.round(tasarim.cozumSatir) || 4));
  const out: DocBlock[] = [];
  for (let i = 0; i < bloklar.length; i++) {
    const b = bloklar[i];
    out.push(b);
    if (b.kind !== "question") continue;
    const sonraki = bloklar[i + 1];
    if (sonraki?.kind === "answerLines") continue;
    out.push({ kind: "answerLines", count: adet, style: stil });
  }
  return out;
}

export type CevapSatiri = {
  no: number;
  cevap: string;
  cozum?: string;
  puan?: number;
  /** Sistem cevap uydurmadı; öğretmen girmemişse metin bunu söyler. */
  girildi: boolean;
};

export function cevapAnahtariSatirlari(
  ogeler: { blok: DocBlock; cevap?: string; cozum?: string; puan?: number }[]
): CevapSatiri[] {
  const satirlar: CevapSatiri[] = [];
  for (const o of ogeler) {
    if (o.blok.kind !== "question" && !(o.blok.kind === "image" && o.blok.rol === "soru")) continue;
    const no = o.blok.no ?? satirlar.length + 1;
    const cevap = (o.cevap || "").trim();
    satirlar.push({
      no,
      cevap: cevap || "Cevap girilmedi",
      cozum: (o.cozum || "").trim() || undefined,
      puan: typeof o.puan === "number" && o.puan > 0 ? o.puan : undefined,
      girildi: Boolean(cevap),
    });
  }
  return satirlar;
}

/** Toplam 100 olacak şekilde tam sayı dağıtır. Öğretmen onaylamadan uygulanmaz. */
export function puanOner(adet: number, toplam = 100): number[] {
  const n = Math.max(0, Math.floor(adet));
  if (!n) return [];
  const hedef = Math.max(0, Math.round(toplam));
  const taban = Math.floor(hedef / n);
  let kalan = hedef - taban * n;
  return Array.from({ length: n }, () => {
    const ekstra = kalan > 0 ? 1 : 0;
    if (kalan > 0) kalan -= 1;
    return taban + ekstra;
  });
}

export type FoyOge = {
  id: string;
  blok: DocBlock;
  cevap?: string;
  cozum?: string;
  puan?: number;
  kaynak?: KirpmaAlani;
};

export function soruOgeleriniYenile(ogeler: FoyOge[]): FoyOge[] {
  let no = 1;
  return ogeler.map((o) => {
    if (o.blok.kind === "question" || (o.blok.kind === "image" && o.blok.rol === "soru")) {
      return { ...o, blok: { ...o.blok, no: no++ } };
    }
    if (o.blok.kind === "image" && o.blok.no != null) {
      const { no: _numara, ...kalan } = o.blok;
      return { ...o, blok: kalan };
    }
    return o;
  });
}

export type KirpmaAlani = {
  pdfAd: string;
  sayfa: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function kirpmaParmakizi(a: KirpmaAlani): string {
  const q = (n: number) => Math.round(n);
  return `${a.pdfAd}|${a.sayfa}|${q(a.x)}|${q(a.y)}|${q(a.width)}|${q(a.height)}`;
}

/** Aynı sayfadaki örtüşen kırpmalar. 0.8 üzeri tekrar sayılır. */
export function kirpmaCakisiyor(a: KirpmaAlani, b: KirpmaAlani): boolean {
  if (a.pdfAd !== b.pdfAd || a.sayfa !== b.sayfa) return false;
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const kesisim = w * h;
  const birlesim = a.width * a.height + b.width * b.height - kesisim;
  if (birlesim <= 0) return false;
  return kesisim / birlesim >= 0.8;
}

export type KaliteNotu = { seviye: "uyari" | "bilgi"; mesaj: string };

export function foyKaliteKontrol(girdi: {
  bloklar: DocBlock[];
  ogretmenIndir: boolean;
  cevapsizSoru: number;
  filigran: boolean;
  teshisDusen: number;
  teshisZorlanan: number;
}): KaliteNotu[] {
  const notlar: KaliteNotu[] = [];
  if (girdi.teshisDusen > 0) {
    notlar.push({
      seviye: "uyari",
      mesaj: `${girdi.teshisDusen} blok sayfaya sığmadı. İndirmeden önce yerleşimi kontrol edin.`,
    });
  }
  if (girdi.teshisZorlanan > 0) {
    notlar.push({
      seviye: "uyari",
      mesaj: `${girdi.teshisZorlanan} blok sütundan uzun; şekil veya metin kesilmiş görünebilir.`,
    });
  }
  const sorular = girdi.bloklar.filter((b) => b.kind === "question");
  if (sorular.some((b) => b.kind === "question" && b.no == null)) {
    notlar.push({ seviye: "uyari", mesaj: "Numarasız soru var." });
  }
  for (const b of girdi.bloklar) {
    if (b.kind === "image" && b.dataUrl.length < 8000) {
      notlar.push({
        seviye: "bilgi",
        mesaj: "Küçük bir görsel var. Yazıcıda flu çıkabilir; kaynağı daha yüksek netlikle yeniden kırpabilirsiniz.",
      });
      break;
    }
    if (b.kind === "formula" && !b.render?.dataUrl) {
      notlar.push({ seviye: "uyari", mesaj: "Görseli oluşmamış bir formül var." });
      break;
    }
  }
  if (girdi.ogretmenIndir && girdi.cevapsizSoru > 0) {
    notlar.push({
      seviye: "uyari",
      mesaj: `${girdi.cevapsizSoru} sorunun cevabı yok. Sistem cevap uydurmaz; anahtarda "Cevap girilmedi" yazar.`,
    });
  }
  if (!girdi.filigran) {
    notlar.push({
      seviye: "bilgi",
      mesaj: "Filigran kapalı. Sayfa ortasında kurum adı görünmez.",
    });
  }
  return notlar;
}
