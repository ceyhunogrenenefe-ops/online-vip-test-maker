/**
 * Yapıştırma temizleyici için gerçek kaynak örnekleri.
 * Word ve Google Dokümanlar'ın ürettiği HTML sadeleştirilmiş ama
 * karakteristik artıkları (mso-, o:p, sarmalayıcı span'ler) korunmuş
 * biçimde alındı.
 */

import type { PasteResult } from "./paste-clean";

export type Fixture = {
  ad: string;
  html?: string;
  text?: string;
  /** Sonucu denetleyen koşul — true dönerse geçti */
  bekle: (r: PasteResult) => { gecti: boolean; aciklama: string };
};

const blokTurleri = (r: PasteResult) => r.blocks.map((b) => b.kind).join(",");

export const FIXTURES: Fixture[] = [
  {
    ad: "Word — mso artıkları ve Türkçe karakterler",
    html: `<!--[if gte mso 9]><xml><w:WordDocument/></xml><![endif]-->
      <p class="MsoNormal" style="margin:0cm;mso-pagination:widow-orphan">
        <span lang="TR" style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif">
          Basınç, birim yüzeye uygulanan dik kuvvettir.<o:p></o:p>
        </span>
      </p>`,
    bekle: (r) => {
      const b = r.blocks[0];
      const metin = b?.kind === "paragraph" ? b.runs.map((x) => x.text).join("") : "";
      const gecti =
        r.blocks.length === 1 &&
        b?.kind === "paragraph" &&
        metin === "Basınç, birim yüzeye uygulanan dik kuvvettir." &&
        !JSON.stringify(r.blocks).includes("mso");
      return { gecti, aciklama: `blok=${blokTurleri(r)} metin="${metin}"` };
    },
  },
  {
    ad: "Kalın ve italik anlamı korunur, yazı tipi atılır",
    html: `<p style="font-family:Arial;color:#ff0000">
        Normal <b style="font-weight:700">kalın</b> ve <i>italik</i> yazı.
      </p>`,
    bekle: (r) => {
      const b = r.blocks[0];
      if (b?.kind !== "paragraph") return { gecti: false, aciklama: blokTurleri(r) };
      const kalin = b.runs.find((x) => x.bold)?.text.trim();
      const italik = b.runs.find((x) => x.italic)?.text.trim();
      const renkKaldiMi = JSON.stringify(r.blocks).includes("ff0000");
      return {
        gecti: kalin === "kalın" && italik === "italik" && !renkKaldiMi,
        aciklama: `kalın="${kalin}" italik="${italik}" renkKaldı=${renkKaldiMi}`,
      };
    },
  },
  {
    ad: "Üst ve alt simge korunur (kimya/fizik)",
    html: `<p>H<sub>2</sub>O ve x<sup>2</sup></p>`,
    bekle: (r) => {
      const b = r.blocks[0];
      if (b?.kind !== "paragraph") return { gecti: false, aciklama: blokTurleri(r) };
      const alt = b.runs.find((x) => x.sub)?.text;
      const ust = b.runs.find((x) => x.sup)?.text;
      return { gecti: alt === "2" && ust === "2", aciklama: `alt=${alt} üst=${ust}` };
    },
  },
  {
    ad: "Madde işaretli liste korunur",
    html: `<ul><li>Birinci madde</li><li>İkinci madde</li><li>Üçüncü</li></ul>`,
    bekle: (r) => {
      const b = r.blocks[0];
      const n = b?.kind === "list" ? b.items.length : 0;
      return {
        gecti: b?.kind === "list" && !b.ordered && n === 3,
        aciklama: `tür=${b?.kind} madde=${n}`,
      };
    },
  },
  {
    ad: "Soru kökü ve şıklar tek soruya toplanır",
    html: `<p>1. Yüzey alanı yarıya indirilirse basınç nasıl değişir?</p>
      <p>A) İki katına çıkar</p><p>B) Yarıya iner</p>
      <p>C) Değişmez</p><p>D) Dörtte birine iner</p>`,
    bekle: (r) => {
      const b = r.blocks[0];
      if (b?.kind !== "question") return { gecti: false, aciklama: blokTurleri(r) };
      const etiketler = b.options.map((o) => o.label).join("");
      const kok = b.stem.map((x) => x.text).join("");
      return {
        gecti:
          r.blocks.length === 1 &&
          etiketler === "ABCD" &&
          kok.startsWith("Yüzey alanı") &&
          !kok.startsWith("1."),
        aciklama: `şıklar=${etiketler} kök="${kok.slice(0, 30)}"`,
      };
    },
  },
  {
    ad: "Tek paragrafta alt alta yazılmış şıklar ayrılır",
    text: `2. Aşağıdakilerden hangisi doğrudur?
A) Birinci
B) İkinci
C) Üçüncü`,
    bekle: (r) => {
      const b = r.blocks[0];
      const n = b?.kind === "question" ? b.options.length : 0;
      return { gecti: b?.kind === "question" && n === 3, aciklama: `tür=${b?.kind} şık=${n}` };
    },
  },
  {
    ad: "Tablo yapısı korunur",
    html: `<table><tr><th>Madde</th><th>Yoğunluk</th></tr>
      <tr><td>Su</td><td>1,0</td></tr><tr><td>Cıva</td><td>13,6</td></tr></table>`,
    bekle: (r) => {
      const b = r.blocks[0];
      if (b?.kind !== "table") return { gecti: false, aciklama: blokTurleri(r) };
      return {
        gecti: b.rows.length === 3 && b.rows[2][1] === "13,6",
        aciklama: `satır=${b.rows.length} son=${JSON.stringify(b.rows[2])}`,
      };
    },
  },
  {
    ad: "LaTeX formülü ayrı blok olur",
    text: `Basınç formülü $P = \\frac{F}{A}$ şeklindedir.`,
    bekle: (r) => {
      const f = r.blocks.find((b) => b.kind === "formula");
      return {
        gecti:
          r.blocks.length === 3 &&
          f?.kind === "formula" &&
          f.latex === "P = \\frac{F}{A}",
        aciklama: `blok=${blokTurleri(r)} latex=${f?.kind === "formula" ? f.latex : "-"}`,
      };
    },
  },
  {
    ad: "Görünmez karakterler ve akıllı tırnaklar sadeleşir",
    text: "​ Öğrenci “basınç” dedi​.",
    bekle: (r) => {
      const b = r.blocks[0];
      const t = b?.kind === "paragraph" ? b.runs.map((x) => x.text).join("") : "";
      return {
        gecti: t === 'Öğrenci "basınç" dedi.' && !/[​ “]/.test(t),
        aciklama: `"${t}"`,
      };
    },
  },
  {
    ad: "Script ve stil atılır",
    html: `<div><script>alert(1)</script><style>p{color:red}</style><p>Güvenli metin</p></div>`,
    bekle: (r) => {
      const d = JSON.stringify(r.blocks);
      return {
        gecti:
          r.blocks.length === 1 &&
          !d.includes("alert") &&
          !d.includes("color:red"),
        aciklama: `blok=${blokTurleri(r)}`,
      };
    },
  },
  {
    ad: "Google Dokümanlar sarmalayıcıları aşılır",
    html: `<b style="font-weight:normal" id="docs-internal-guid-abc">
        <p dir="ltr"><span style="font-size:11pt;font-family:Arial">İlk paragraf</span></p>
        <p dir="ltr"><span style="font-size:11pt">İkinci paragraf</span></p>
      </b>`,
    bekle: (r) => {
      const hepsiParagraf = r.blocks.every((b) => b.kind === "paragraph");
      const kalinYok = !JSON.stringify(r.blocks).includes('"bold":true');
      return {
        gecti: r.blocks.length === 2 && hepsiParagraf && kalinYok,
        aciklama: `blok=${blokTurleri(r)} yanlışKalın=${!kalinYok}`,
      };
    },
  },
  {
    ad: "Satır sonu <br> metinde korunur",
    html: `<p>Birinci satır<br>İkinci satır</p>`,
    bekle: (r) => {
      const b = r.blocks[0];
      const t = b?.kind === "paragraph" ? b.runs.map((x) => x.text).join("") : "";
      return { gecti: t.includes("\n"), aciklama: JSON.stringify(t) };
    },
  },
];
