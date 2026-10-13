/**
 * Yapıştırma temizleyici — Word, Google Dokümanlar, PDF ve web'den gelen
 * içeriği kurumsal şablona uygun yapıya çevirir.
 *
 * Tasarım kararı: kaynak biçimlendirmesi KORUNMAZ, anlamı korunur.
 * Yazı tipi, renk, punto, satır aralığı gibi kaynak stilleri atılır;
 * kalın/italik/üst-alt simge, madde işareti, tablo ve soru seçeneği gibi
 * ANLAM taşıyan yapılar korunur. Kurumsal şablonun tek tip görünmesi
 * ancak böyle sağlanır (spec 4 ve 11).
 */

export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  sup?: boolean;
  sub?: boolean;
};

export type PasteBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] }
  | { kind: "question"; stem: Run[]; options: { label: string; runs: Run[] }[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "formula"; latex: string; source: "mathml" | "tex" }
  | { kind: "image"; src: string };

export type PasteResult = {
  blocks: PasteBlock[];
  /** Öğretmene gösterilecek uyarılar — sessizce bozmak yerine bildiriyoruz */
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* Metin normalleştirme                                                */
/* ------------------------------------------------------------------ */

/**
 * Türkçe karakterler bozulmasın diye yalnızca GÖRÜNMEZ ve TİPOGRAFİK
 * karakterler sadeleştirilir; harflere dokunulmaz.
 */
export function normalizeText(ham: string): string {
  return (
    ham
      // Bölünemez boşluk ve dar boşluklar → normal boşluk
      .replace(/[     ]/g, " ")
      // Sıfır genişlikli karakterler (Word ve PDF kopyalarında sık)
      .replace(/[​‌‍﻿]/g, "")
      // Akıllı tırnaklar → düz
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”‟]/g, '"')
      // Uzun tireler korunur ama yazı tipi olmayan tire türleri sadeleşir
      .replace(/[‐‑]/g, "-")
      // Satır sonu birliği
      .replace(/\r\n?/g, "\n")
      // Üç noktayı tek karaktere indirme (PDF kopyalarında bölünebiliyor)
      .replace(/\.\s?\.\s?\./g, "…")
  );
}

function bosMu(s: string): boolean {
  return !s.replace(/\s/g, "");
}

function runlariBirlestir(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const son = out[out.length - 1];
    if (
      son &&
      !!son.bold === !!r.bold &&
      !!son.italic === !!r.italic &&
      !!son.sup === !!r.sup &&
      !!son.sub === !!r.sub
    ) {
      son.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  // Baş/son boşluk temizliği
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, "");
    out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
  }
  return out.filter((r) => r.text);
}

export function runlariMetne(runs: Run[]): string {
  return runs.map((r) => r.text).join("");
}

/* ------------------------------------------------------------------ */
/* Kaynak artıklarını ayıklama                                         */
/* ------------------------------------------------------------------ */

const ATILACAK_ETIKETLER = new Set([
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "HEAD",
  "TITLE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
]);

/** Word/Google Dokümanlar artıkları */
function kaynakArtiklariniTemizle(kok: Element) {
  // HTML yorumları (Word "[if gte mso 9]" blokları)
  const yurutec = kok.ownerDocument.createTreeWalker(
    kok,
    NodeFilter.SHOW_COMMENT
  );
  const yorumlar: Comment[] = [];
  while (yurutec.nextNode()) yorumlar.push(yurutec.currentNode as Comment);
  yorumlar.forEach((c) => c.remove());

  kok.querySelectorAll("*").forEach((el) => {
    if (ATILACAK_ETIKETLER.has(el.tagName)) {
      el.remove();
      return;
    }
    // Word'ün <o:p>, <w:...> gibi ad alanlı etiketleri
    if (el.tagName.includes(":")) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    // Tüm sunum öznitelikleri atılır — kurumsal biçim tek tip olmalı
    for (const ad of Array.from(el.getAttributeNames())) {
      if (el.tagName === "IMG" && (ad === "src" || ad === "alt")) continue;
      if (el.tagName === "TD" || el.tagName === "TH") {
        if (ad === "colspan" || ad === "rowspan") continue;
      }
      el.removeAttribute(ad);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Satır içi çözümleme                                                 */
/* ------------------------------------------------------------------ */

function satirIciCoz(dugum: Node, miras: Omit<Run, "text"> = {}): Run[] {
  if (dugum.nodeType === Node.TEXT_NODE) {
    const t = normalizeText(dugum.textContent || "");
    return t ? [{ text: t, ...miras }] : [];
  }
  if (dugum.nodeType !== Node.ELEMENT_NODE) return [];

  const el = dugum as Element;
  const etiket = el.tagName;

  if (etiket === "BR") return [{ text: "\n", ...miras }];
  if (etiket === "IMG") return [];

  const sonraki: Omit<Run, "text"> = { ...miras };
  if (etiket === "B" || etiket === "STRONG") sonraki.bold = true;
  if (etiket === "I" || etiket === "EM") sonraki.italic = true;
  if (etiket === "SUP") sonraki.sup = true;
  if (etiket === "SUB") sonraki.sub = true;

  const out: Run[] = [];
  el.childNodes.forEach((c) => out.push(...satirIciCoz(c, sonraki)));
  return out;
}

/* ------------------------------------------------------------------ */
/* Formül yakalama                                                     */
/* ------------------------------------------------------------------ */

/** $...$ veya \( ... \) arasındaki LaTeX */
const TEX_KALIBI = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/;

export function metindeTexVarMi(metin: string): boolean {
  return TEX_KALIBI.test(metin);
}

/**
 * Paragrafı metin ve formül parçalarına böler.
 * Formülü sessizce metne çevirmek yerine ayrı blok yapıyoruz ki
 * doğru dizilsin (spec 4: "formüller bozulmadan aktarılmalı").
 */
function texAyikla(runs: Run[]): PasteBlock[] {
  const tamMetin = runlariMetne(runs);
  if (!metindeTexVarMi(tamMetin)) return [{ kind: "paragraph", runs }];

  const bloklar: PasteBlock[] = [];
  let kalan = tamMetin;
  let guvenlik = 0;
  while (kalan && guvenlik++ < 200) {
    const m = TEX_KALIBI.exec(kalan);
    if (!m) break;
    const once = kalan.slice(0, m.index);
    if (!bosMu(once)) bloklar.push({ kind: "paragraph", runs: [{ text: once.trim() }] });
    const latex = (m[1] || m[2] || m[3] || m[4] || "").trim();
    if (latex) bloklar.push({ kind: "formula", latex, source: "tex" });
    kalan = kalan.slice(m.index + m[0].length);
  }
  if (!bosMu(kalan)) bloklar.push({ kind: "paragraph", runs: [{ text: kalan.trim() }] });
  return bloklar.length ? bloklar : [{ kind: "paragraph", runs }];
}

/* ------------------------------------------------------------------ */
/* Soru / şık yakalama                                                 */
/* ------------------------------------------------------------------ */

/** A) A. A- a) şeklindeki şık etiketleri */
const SIK_KALIBI = /^\s*([A-Ea-e])\s*[\)\.\-–]\s+(.*)$/;
/** 1. 12) şeklindeki soru numaraları */
const SORU_NO_KALIBI = /^\s*(\d{1,2})\s*[\)\.]\s+(.*)$/;

export function sikEtiketi(satir: string): { label: string; kalan: string } | null {
  const m = SIK_KALIBI.exec(satir);
  if (!m) return null;
  return { label: m[1].toLocaleUpperCase("tr-TR"), kalan: m[2] };
}

/**
 * Ardışık paragrafları soruya dönüştürür: kök + şıklar.
 * Şıklar ayrı paragraflarda ya da tek paragrafta alt alta olabilir.
 */
function sorulariTopla(bloklar: PasteBlock[]): PasteBlock[] {
  const out: PasteBlock[] = [];
  let i = 0;
  while (i < bloklar.length) {
    const b = bloklar[i];
    if (b.kind !== "paragraph") {
      out.push(b);
      i++;
      continue;
    }
    const metin = runlariMetne(b.runs);
    const soruNo = SORU_NO_KALIBI.exec(metin);
    // Soru kökü gibi görünüyor mu ve ardından şık geliyor mu?
    const sonrakiSik =
      i + 1 < bloklar.length &&
      bloklar[i + 1].kind === "paragraph" &&
      sikEtiketi(runlariMetne((bloklar[i + 1] as { runs: Run[] }).runs));
    if (!soruNo && !sonrakiSik) {
      out.push(b);
      i++;
      continue;
    }
    if (!sonrakiSik) {
      out.push(b);
      i++;
      continue;
    }

    const stem = soruNo ? [{ text: soruNo[2] }] : b.runs;
    const secenekler: { label: string; runs: Run[] }[] = [];
    let j = i + 1;
    while (j < bloklar.length && bloklar[j].kind === "paragraph") {
      const s = runlariMetne((bloklar[j] as { runs: Run[] }).runs);
      const sik = sikEtiketi(s);
      if (!sik) break;
      secenekler.push({ label: sik.label, runs: [{ text: sik.kalan }] });
      j++;
    }
    if (secenekler.length >= 2) {
      out.push({ kind: "question", stem, options: secenekler });
      i = j;
    } else {
      out.push(b);
      i++;
    }
  }
  return out;
}

/** Tek paragraf içinde satır satır yazılmış şıkları ayırır */
function satirIciSiklariAyir(bloklar: PasteBlock[]): PasteBlock[] {
  const out: PasteBlock[] = [];
  for (const b of bloklar) {
    if (b.kind !== "paragraph") {
      out.push(b);
      continue;
    }
    const metin = runlariMetne(b.runs);
    if (!metin.includes("\n")) {
      out.push(b);
      continue;
    }
    const satirlar = metin.split("\n").filter((l) => !bosMu(l));
    const sikSayisi = satirlar.filter((l) => sikEtiketi(l)).length;
    if (sikSayisi >= 2) {
      satirlar.forEach((l) => out.push({ kind: "paragraph", runs: [{ text: l.trim() }] }));
    } else {
      out.push(b);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ana çözümleyici                                                     */
/* ------------------------------------------------------------------ */

function elemaniCoz(el: Element, bloklar: PasteBlock[], warnings: string[]) {
  const etiket = el.tagName;

  if (etiket === "MATH") {
    // MathML — LaTeX'e çevrilmesi editörde yapılır; şimdilik ham tutulur
    warnings.push(
      "Yapıştırılan içerikte MathML formülü var; formül editöründe doğrulamanız önerilir."
    );
    bloklar.push({
      kind: "formula",
      latex: el.textContent?.trim() || "",
      source: "mathml",
    });
    return;
  }

  if (/^H[1-6]$/.test(etiket)) {
    const t = normalizeText(el.textContent || "").trim();
    if (t) {
      const n = Number(etiket[1]);
      bloklar.push({ kind: "heading", level: (n <= 1 ? 1 : n === 2 ? 2 : 3) as 1 | 2 | 3, text: t });
    }
    return;
  }

  if (etiket === "UL" || etiket === "OL") {
    const items: Run[][] = [];
    el.querySelectorAll(":scope > li").forEach((li) => {
      const r = runlariBirlestir(satirIciCoz(li));
      if (r.length) items.push(r);
    });
    if (items.length) bloklar.push({ kind: "list", ordered: etiket === "OL", items });
    return;
  }

  if (etiket === "TABLE") {
    const rows: string[][] = [];
    el.querySelectorAll("tr").forEach((tr) => {
      const hucreler: string[] = [];
      tr.querySelectorAll("td,th").forEach((td) =>
        hucreler.push(normalizeText(td.textContent || "").trim())
      );
      if (hucreler.some((h) => h)) rows.push(hucreler);
    });
    if (rows.length) bloklar.push({ kind: "table", rows });
    return;
  }

  if (etiket === "IMG") {
    const src = el.getAttribute("src") || "";
    if (src.startsWith("data:") || /^https?:/i.test(src)) {
      bloklar.push({ kind: "image", src });
    } else if (src) {
      warnings.push("Yapıştırılan bir görsel aktarılamadı; kaynağa erişilemiyor.");
    }
    return;
  }

  // Paragraf benzeri
  const runs = runlariBirlestir(satirIciCoz(el));
  if (!runs.length) return;
  texAyikla(runs).forEach((b) => bloklar.push(b));
}

const BLOK_ETIKETLERI = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "TABLE", "IMG", "MATH", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE",
]);

/** Yapıştırılan HTML'i temiz bloklara çevirir. */
export function cleanPastedHtml(html: string): PasteResult {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const kok = doc.body;
  if (!kok) return { blocks: [], warnings };

  kaynakArtiklariniTemizle(kok);

  const bloklar: PasteBlock[] = [];

  const gez = (dugum: Node) => {
    dugum.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        const t = normalizeText(c.textContent || "");
        if (!bosMu(t)) {
          runlariBirlestir([{ text: t }]).length &&
            texAyikla([{ text: t.trim() }]).forEach((b) => bloklar.push(b));
        }
        return;
      }
      if (c.nodeType !== Node.ELEMENT_NODE) return;
      const el = c as Element;
      if (BLOK_ETIKETLERI.has(el.tagName)) {
        // İçinde başka blok varsa (Word sarmalayıcı div'leri) içeri in
        const icBlok = el.querySelector(
          "p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,img,math"
        );
        if ((el.tagName === "DIV" || el.tagName === "SECTION" || el.tagName === "ARTICLE") && icBlok) {
          gez(el);
        } else {
          elemaniCoz(el, bloklar, warnings);
        }
      } else {
        gez(el);
      }
    });
  };
  gez(kok);

  const ayrilmis = satirIciSiklariAyir(bloklar);
  const sorulu = sorulariTopla(ayrilmis);

  return { blocks: sorulu, warnings: [...new Set(warnings)] };
}

/** Düz metin yapıştırma — HTML yoksa */
export function cleanPastedText(text: string): PasteResult {
  const t = normalizeText(text);
  const paragraflar = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bloklar: PasteBlock[] = [];
  paragraflar.forEach((p) => {
    const satirlar = p.split("\n").map((l) => l.trim()).filter(Boolean);
    const sikSayisi = satirlar.filter((l) => sikEtiketi(l)).length;
    if (sikSayisi >= 2) {
      satirlar.forEach((l) => bloklar.push({ kind: "paragraph", runs: [{ text: l }] }));
    } else {
      texAyikla([{ text: p }]).forEach((b) => bloklar.push(b));
    }
  });
  return { blocks: sorulariTopla(bloklar), warnings: [] };
}

/** Pano olayından en iyi kaynağı seçer. */
export function cleanFromClipboard(data: DataTransfer): PasteResult {
  const html = data.getData("text/html");
  if (html && html.trim()) return cleanPastedHtml(html);
  return cleanPastedText(data.getData("text/plain") || "");
}
