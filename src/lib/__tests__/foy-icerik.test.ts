import test from "node:test";
import assert from "node:assert/strict";
import { blokEtiketi, soruNumaralariniYenile, yapistirmayiBelgeye } from "../foy-icerik.ts";
import type { PasteBlock } from "../paste-clean.ts";
import type { DocBlock } from "../pdf-blocks.ts";
import type { RenderedFormula } from "../latex-render.ts";

const SAHTE_FORMUL: RenderedFormula = {
  dataUrl: "data:image/png;base64,AAA",
  widthPx: 100,
  heightPx: 40,
  aspect: 2.5,
  widthEx: 10,
  heightEx: 4,
};

// Ters bolu kaynakta kacis dizisi olarak yorumlanmasin diye kod ile uretiliyor
const TB = String.fromCharCode(92);
const LATEX_ORNEK = `P = ${TB}frac{F}{A}`;

const cizOk = async () => SAHTE_FORMUL;
const cizPatlat = async () => {
  throw new Error("MathJax yok");
};

test("yapistirma bloklari belge bloklarina cevrilir", async () => {
  const girdi: PasteBlock[] = [
    { kind: "heading", level: 2, text: "KATI BASINCI" },
    { kind: "paragraph", runs: [{ text: "Basınç" }] },
    { kind: "list", ordered: false, items: [[{ text: "a" }], [{ text: "b" }]] },
    { kind: "table", rows: [["x", "y"]] },
  ];
  const r = await yapistirmayiBelgeye(girdi, { formulCiz: cizOk });
  assert.deepEqual(r.bloklar.map((b) => b.kind), ["sectionTitle", "paragraph", "list", "table"]);
  assert.equal(r.uyarilar.length, 0);
});

test("sorular sirayla numaralanir", async () => {
  const soru = (s: string): PasteBlock => ({
    kind: "question",
    stem: [{ text: s }],
    options: [{ label: "A", runs: [{ text: "1" }] }],
  });
  const r = await yapistirmayiBelgeye([soru("bir"), soru("iki"), soru("uc")], { formulCiz: cizOk });
  assert.deepEqual(
    r.bloklar.map((b) => (b.kind === "question" ? b.no : null)),
    [1, 2, 3]
  );
  assert.equal(r.sonrakiSoruNo, 4);
});

test("ilkSoruNo ile numaralandirma kaldigi yerden devam eder", async () => {
  const soru: PasteBlock = { kind: "question", stem: [{ text: "x" }], options: [] };
  const r = await yapistirmayiBelgeye([soru], { ilkSoruNo: 7, formulCiz: cizOk });
  assert.equal(r.bloklar[0].kind === "question" ? r.bloklar[0].no : null, 7);
  assert.equal(r.sonrakiSoruNo, 8);
});

test("formul cizilirse formul blogu uretilir", async () => {
  const r = await yapistirmayiBelgeye(
    [{ kind: "formula", latex: LATEX_ORNEK, source: "tex" }],
    { formulCiz: cizOk }
  );
  assert.equal(r.bloklar[0].kind, "formula");
  assert.equal(r.uyarilar.length, 0);
});

test("formul cizilemezse SESSIZCE dusmez, uyari verilir", async () => {
  const r = await yapistirmayiBelgeye(
    [{ kind: "formula", latex: LATEX_ORNEK, source: "tex" }],
    { formulCiz: cizPatlat }
  );
  assert.equal(r.bloklar[0].kind, "paragraph", "kaynak korunmali");
  assert.equal(r.uyarilar.length, 1, "dusen formul bildirilmeli");
  assert.match(r.uyarilar[0], /Formül dizilemedi/);
  assert.match(r.uyarilar[0], /frac/, "hangi formul oldugu yazmali");
});

test("yapistirilan gorsel atlanir ve bildirilir", async () => {
  const r = await yapistirmayiBelgeye([{ kind: "image", src: "x.png" }], { formulCiz: cizOk });
  assert.equal(r.bloklar.length, 0);
  assert.equal(r.uyarilar.length, 1);
});

test("soru numaralari silme sonrasi bastan siralanir", () => {
  const bloklar: DocBlock[] = [
    { kind: "question", no: 1, stem: [{ text: "a" }], options: [] },
    { kind: "paragraph", runs: [{ text: "arada" }] },
    { kind: "question", no: 5, stem: [{ text: "b" }], options: [] },
    { kind: "question", no: 9, stem: [{ text: "c" }], options: [] },
  ];
  const y = soruNumaralariniYenile(bloklar);
  assert.deepEqual(
    y.filter((b) => b.kind === "question").map((b) => (b.kind === "question" ? b.no : 0)),
    [1, 2, 3]
  );
  assert.equal(y[1].kind, "paragraph", "soru olmayan bloklar bozulmamali");
});

test("blok etiketi her tur icin metin uretir", () => {
  const turler: DocBlock[] = [
    { kind: "sectionTitle", text: "BAŞLIK" },
    { kind: "paragraph", runs: [{ text: "metin" }] },
    { kind: "list", ordered: true, items: [[{ text: "a" }]] },
    { kind: "question", no: 2, stem: [{ text: "soru" }], options: [] },
    { kind: "table", rows: [["a", "b"]] },
    { kind: "formula", render: SAHTE_FORMUL, latex: "x^2" },
    { kind: "infoBox", tone: "dikkat", title: "DİKKAT", text: "t" },
    { kind: "answerLines", count: 3 },
    { kind: "spacer", heightMm: 5 },
  ];
  for (const b of turler) {
    const e = blokEtiketi(b);
    assert.ok(e && e.length > 0, `${b.kind} icin etiket bos`);
  }
  assert.match(blokEtiketi(turler[3]), /Soru 2/);
});
