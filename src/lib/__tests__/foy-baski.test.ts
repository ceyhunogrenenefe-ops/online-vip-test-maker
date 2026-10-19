import test from "node:test";
import assert from "node:assert/strict";
import type { DocBlock } from "../pdf-blocks.ts";
import {
  cevapAnahtariSatirlari,
  foyBaskiBloklari,
  foyKaliteKontrol,
  kirpmaCakisiyor,
  puanOner,
} from "../foy-baski.ts";
import { varsayilanTasarim } from "../foy-kunye.ts";

const soru = (no: number): DocBlock => ({
  kind: "question",
  no,
  stem: [{ text: `soru ${no}` }],
  options: [],
});

test("cozum alani sorunun altina eklenir, var olan cevap satiri tekrarlanmaz", () => {
  const bloklar: DocBlock[] = [
    soru(1),
    { kind: "answerLines", count: 2 },
    soru(2),
    { kind: "pageBreak" },
  ];
  const tasarim = { ...varsayilanTasarim(), cozum: "cizgili" as const, cozumSatir: 3 };
  const baski = foyBaskiBloklari(bloklar, tasarim);
  assert.equal(baski.length, 5);
  assert.equal(baski[1].kind, "answerLines");
  assert.equal(baski[3].kind, "answerLines");
  assert.equal(baski[4].kind, "pageBreak", "sayfa sonu silinmemeli");
});

test("cozum kapaliyken blok listesi aynen kalir", () => {
  const bloklar = [soru(1)];
  assert.equal(foyBaskiBloklari(bloklar, varsayilanTasarim()), bloklar);
});

test("bos cevap uydurulmaz", () => {
  const satirlar = cevapAnahtariSatirlari([
    { blok: soru(1), cevap: "12" },
    { blok: soru(2) },
  ]);
  assert.equal(satirlar[0].cevap, "12");
  assert.equal(satirlar[0].girildi, true);
  assert.equal(satirlar[1].cevap, "Cevap girilmedi");
  assert.equal(satirlar[1].girildi, false);
});

test("gorsel soru cevap anahtarina girer, cozum girmez", () => {
  const satirlar = cevapAnahtariSatirlari([
    { blok: { kind: "image", dataUrl: "x", aspect: 1, rol: "soru", no: 4 }, cevap: "B" },
    { blok: { kind: "image", dataUrl: "x", aspect: 1, rol: "cozum" }, cevap: "yok" },
  ]);
  assert.equal(satirlar.length, 1);
  assert.equal(satirlar[0].no, 4);
  assert.equal(satirlar[0].cevap, "B");
});

test("puan onerisi toplami 100 eder", () => {
  const p = puanOner(3);
  assert.deepEqual(p, [34, 33, 33]);
  assert.equal(p.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(puanOner(0), []);
});

test("ayni bolgenin tekrar kirpilmasi uyarilir", () => {
  const a = { pdfAd: "deneme.pdf", sayfa: 12, x: 10, y: 20, width: 100, height: 80 };
  const b = { ...a, x: 12, y: 22 };
  const c = { ...a, y: 400 };
  assert.equal(kirpmaCakisiyor(a, b), true);
  assert.equal(kirpmaCakisiyor(a, c), false);
});

test("kalite kontrolu cevapsiz ogretmen ciktisini bildirir", () => {
  const notlar = foyKaliteKontrol({
    bloklar: [soru(1)],
    ogretmenIndir: true,
    cevapsizSoru: 1,
    filigran: true,
    teshisDusen: 0,
    teshisZorlanan: 0,
  });
  assert.ok(notlar.some((n) => n.mesaj.includes("uydurmaz")));
});
