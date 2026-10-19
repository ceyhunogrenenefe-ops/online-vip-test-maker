import type { DocBlock } from "./pdf-blocks";
import type { PasteBlock } from "./paste-clean";
import type { RenderedFormula } from "./latex-render";

/**
 * Yapıştırma / OCR çıktısını (PasteBlock) föy belge bloklarına (DocBlock)
 * çevirir. Yapıştırma, fotoğraftan aktarım ve YZ soru üretimi aynı
 * PasteBlock biçimini ürettiği için tek dönüştürücü yeterli.
 *
 * Bu mantık /bilesen-deneme içinde gömülüydü ve formül çizimi
 * başarısız olduğunda LaTeX kaynağını sessizce düz metin olarak
 * yazıyordu: öğretmen föyde "P = \frac{F}{A}" görürdü ve nereden
 * geldiğini bilemezdi. Artık düşülen formül uyarı olarak bildiriliyor
 * ("eksik veya yanlış tanınan formülleri sessizce değiştirme" kuralı).
 */

export type DonusumSonuc = {
  bloklar: DocBlock[];
  /** Öğretmene gösterilecek uyarılar */
  uyarilar: string[];
  /** Bir sonraki eklemede kullanılacak soru numarası */
  sonrakiSoruNo: number;
};

export type DonusumSecenek = {
  /** Soru numaralandırması bu değerden başlar (varsayılan 1) */
  ilkSoruNo?: number;
  /** Formül çizici — testte yerine geçmesi için dışarıdan verilebilir */
  formulCiz?: (latex: string) => Promise<RenderedFormula>;
};

async function varsayilanFormulCiz(latex: string): Promise<RenderedFormula> {
  // Tembel yükleme: MathJax yalnızca gerçekten formül varsa yüklenir,
  // böylece bu modül Node testlerinde bağımlılık çekmez.
  const { renderLatexToPng } = await import("./latex-render");
  return renderLatexToPng(latex, { olcek: 4 });
}

export async function yapistirmayiBelgeye(
  girdi: PasteBlock[],
  secenek: DonusumSecenek = {}
): Promise<DonusumSonuc> {
  const formulCiz = secenek.formulCiz ?? varsayilanFormulCiz;
  const out: DocBlock[] = [];
  const uyarilar: string[] = [];
  let soruNo = Math.max(1, Math.round(secenek.ilkSoruNo ?? 1));

  for (const b of girdi) {
    if (b.kind === "heading") {
      out.push({ kind: "sectionTitle", text: b.text });
    } else if (b.kind === "paragraph") {
      out.push({ kind: "paragraph", runs: b.runs });
    } else if (b.kind === "list") {
      out.push({ kind: "list", ordered: b.ordered, items: b.items });
    } else if (b.kind === "table") {
      out.push({ kind: "table", rows: b.rows });
    } else if (b.kind === "question") {
      out.push({ kind: "question", no: soruNo++, stem: b.stem, options: b.options });
    } else if (b.kind === "formula") {
      try {
        const r = await formulCiz(b.latex);
        out.push({ kind: "formula", render: r, latex: b.latex });
      } catch (e) {
        // Formül dizilemedi: kaynağı koruyoruz ama bunu BİLDİRİYORUZ.
        out.push({ kind: "paragraph", runs: [{ text: b.latex }] });
        uyarilar.push(
          `Formül dizilemedi, LaTeX kaynağı olarak eklendi: "${b.latex}"${
            e instanceof Error && e.message ? ` (${e.message})` : ""
          }`
        );
      }
    } else if (b.kind === "image") {
      // Görsel oranı yüklenmeden bilinemez; editör ekledikten sonra ölçer.
      uyarilar.push("Yapıştırılan görsel atlandı: föye görsel eklemek için Fotoğraftan aktar adımını kullanın.");
    }
  }

  return { bloklar: out, uyarilar, sonrakiSoruNo: soruNo };
}

/** Yazılı soru veya soru olarak işaretlenmiş görsel. Açıklama ve çözüm sayılmaz. */
export function numaraliSoruMu(
  b: DocBlock
): b is Extract<DocBlock, { kind: "question" }> | (Extract<DocBlock, { kind: "image" }> & { rol: "soru" }) {
  return b.kind === "question" || (b.kind === "image" && b.rol === "soru");
}

/** Blok listesinde soru numaralarını baştan sıralar (silme/taşıma sonrası) */
export function soruNumaralariniYenile(bloklar: DocBlock[]): DocBlock[] {
  let no = 1;
  return bloklar.map((b) => {
    if (numaraliSoruMu(b)) return { ...b, no: no++ };
    if (b.kind === "image" && b.no != null) {
      const { no: _numara, ...kalan } = b;
      return kalan;
    }
    return b;
  });
}

/** Blok için kısa, insan okur etiket — editör listesinde gösterilir */
export function blokEtiketi(b: DocBlock): string {
  switch (b.kind) {
    case "sectionTitle":
      return `Bölüm başlığı: ${b.text}`;
    case "paragraph":
      return b.runs.map((r) => r.text).join("").slice(0, 70) || "Paragraf";
    case "list":
      return `${b.ordered ? "Sıralı" : "Madde"} liste (${b.items.length})`;
    case "question":
      return `Soru ${b.no ?? "?"}: ${b.stem.map((r) => r.text).join("").slice(0, 55)}`;
    case "table":
      return `Tablo (${b.rows.length}×${b.rows[0]?.length ?? 0})`;
    case "formula":
      return `Formül: ${b.latex ?? "(LaTeX yok)"}`;
    case "infoBox":
      return `${b.tone === "dikkat" ? "Dikkat" : "Bilgi"} kutusu: ${b.title}`;
    case "answerLines":
      return `Cevap satırı (${b.count})`;
    case "image":
      if (b.rol === "aciklama") return "Açıklama";
      if (b.rol === "cozum") return "Çözüm";
      if (b.rol === "soru") return `Soru ${b.no ?? "?"}: görsel`;
      return "Görsel";
    case "spacer":
      return `Boşluk (${b.heightMm} mm)`;
    case "pageBreak":
      return "Sayfa sonu";
    case "columnBreak":
      return "Sütun sonu";
  }
}
