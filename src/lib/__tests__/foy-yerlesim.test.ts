import test from "node:test";
import assert from "node:assert/strict";
import { foyYerlesimPlani, planBlokSayisi } from "../foy-yerlesim.ts";
import type { DocBlock } from "../pdf-blocks.ts";

/**
 * Bloklar yalnizca yukseklikleriyle ilgilendigi icin spacer kullaniyoruz:
 * olcme islevi testte bizim elimizde, gercek jsPDF olcumu gerekmiyor.
 */
const blok = (h: number): DocBlock => ({ kind: "spacer", heightMm: h });
const olc = (b: DocBlock) => (b.kind === "spacer" ? b.heightMm : 10);

const SECENEK = { ustY: 30, altSinir: 280, maksSayfa: 40 };
// Bir sutuna 250mm sigiyor

test("tek sutuna sigan bloklar tek sayfada kalir", () => {
  const plan = foyYerlesimPlani([blok(50), blok(50), blok(50)], olc, SECENEK);
  assert.equal(plan.sayfalar.length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[0].length, 3);
  assert.equal(plan.dusen.length, 0);
  assert.equal(plan.zorlanan.length, 0);
});

test("ilk sutun dolunca ikinci sutuna gecer", () => {
  // 250mm sutun: 3x90 = 270 > 250, ucuncu blok ikinci sutuna gider
  const plan = foyYerlesimPlani([blok(90), blok(90), blok(90)], olc, SECENEK);
  assert.equal(plan.sayfalar.length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[0].length, 2);
  assert.equal(plan.sayfalar[0].sutunlar[1].length, 1);
});

test("iki sutun dolunca yeni sayfa acilir", () => {
  const plan = foyYerlesimPlani(Array.from({ length: 10 }, () => blok(90)), olc, SECENEK);
  // Sayfa basina 2 sutun x 2 blok = 4 blok -> 10 blok 3 sayfa
  assert.equal(plan.sayfalar.length, 3);
  assert.equal(planBlokSayisi(plan), 10);
  assert.equal(plan.dusen.length, 0);
});

test("y degerleri sutun icinde birikimli ilerler", () => {
  const plan = foyYerlesimPlani([blok(40), blok(60), blok(30)], olc, SECENEK);
  const s = plan.sayfalar[0].sutunlar[0];
  assert.deepEqual(s.map((x) => x.y), [30, 70, 130]);
});

test("sutundan uzun blok zorla yerlestirilir, sessizce dusmez", () => {
  // 400mm blok hicbir sutuna sigmaz
  const plan = foyYerlesimPlani([blok(400), blok(50)], olc, SECENEK);
  assert.deepEqual(plan.zorlanan, [0], "uzun blok zorlanan olarak bildirilmeli");
  assert.equal(plan.dusen.length, 0, "hicbir blok dusmemeli");
  assert.equal(planBlokSayisi(plan), 2, "iki blok da plana girmeli");
  assert.equal(plan.sayfalar[0].sutunlar[0][0].zorlandi, true);
});

test("uzun blok sonsuz donguye girmez", () => {
  const plan = foyYerlesimPlani(Array.from({ length: 5 }, () => blok(400)), olc, SECENEK);
  assert.equal(plan.zorlanan.length, 5);
  assert.equal(plan.dusen.length, 0);
  assert.ok(plan.sayfalar.length <= SECENEK.maksSayfa);
});

test("blok korunumu: cizilen + dusen = verilen", () => {
  const bloklar = [blok(30), blok(400), blok(120), blok(200), blok(45), blok(90)];
  const plan = foyYerlesimPlani(bloklar, olc, SECENEK);
  assert.equal(planBlokSayisi(plan) + plan.dusen.length, bloklar.length);
});

test("maks sayfa asilirsa kalan bloklar DUSEN olarak bildirilir", () => {
  // Her blok bir sutunu doldurur: 2 blok/sayfa, 3 sayfa siniri -> 6 blok yerlesir
  const bloklar = Array.from({ length: 10 }, () => blok(200));
  const plan = foyYerlesimPlani(bloklar, olc, { ...SECENEK, maksSayfa: 3 });
  assert.equal(plan.sayfalar.length, 3);
  assert.equal(planBlokSayisi(plan), 6);
  assert.deepEqual(plan.dusen, [6, 7, 8, 9], "kalanlar sessizce kaybolmamali");
});

test("bos girdi bos plan uretir", () => {
  const plan = foyYerlesimPlani([], olc, SECENEK);
  assert.equal(plan.sayfalar.length, 0);
  assert.equal(plan.dusen.length, 0);
});

test("sayfa sonu otomatik akisi keser ve silinmez", () => {
  const bloklar: DocBlock[] = [blok(40), { kind: "pageBreak" }, blok(40)];
  const plan = foyYerlesimPlani(bloklar, olc, SECENEK);
  assert.equal(plan.sayfalar.length, 2);
  assert.equal(plan.sayfalar[0].sutunlar[0].length, 1);
  assert.equal(plan.sayfalar[1].sutunlar[0][0].indeks, 2);
  assert.equal(plan.dusen.length, 0);
  assert.equal(planBlokSayisi(plan), 2, "sayfa sonu icerik sayilmaz");
});

test("sutun sonu sonraki sutuna gecer", () => {
  const bloklar: DocBlock[] = [blok(40), { kind: "columnBreak" }, blok(40)];
  const plan = foyYerlesimPlani(bloklar, olc, SECENEK);
  assert.equal(plan.sayfalar.length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[0].length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[1][0].indeks, 2);
});

test("tek sutun modu dolunca yeni sayfa acar", () => {
  const plan = foyYerlesimPlani([blok(200), blok(200)], olc, { ...SECENEK, sutunSayisi: 1 });
  assert.equal(plan.sayfalar.length, 2);
  assert.equal(plan.sayfalar[0].sutunlar.length, 1);
});

const olcSatir = (b: DocBlock) => {
  if (b.kind === "spacer") return b.heightMm;
  if (b.kind === "answerLines") return 7 * b.count + 2;
  return 10;
};

test("akilli yerlesim sigmayan cozum boslugunu ayni sutunda kisaltir", () => {
  const satir: DocBlock = { kind: "answerLines", count: 8, style: "lines" };
  const dar = { ustY: 0, altSinir: 100, maksSayfa: 5, sutunSayisi: 2 as const };
  const plan = foyYerlesimPlani([blok(70), satir], olcSatir, { ...dar, akilli: true });
  const sutun = plan.sayfalar[0].sutunlar[0];
  assert.equal(sutun.length, 2);
  assert.equal(sutun[1].blok.kind, "answerLines");
  if (sutun[1].blok.kind === "answerLines") assert.equal(sutun[1].blok.count, 4);
  assert.equal(plan.sayfalar[0].sutunlar[1].length, 0);
});

test("akilli kapaliyken cozum boslugu sonraki sutuna gecer", () => {
  const satir: DocBlock = { kind: "answerLines", count: 8, style: "lines" };
  const dar = { ustY: 0, altSinir: 100, maksSayfa: 5, sutunSayisi: 2 as const };
  const plan = foyYerlesimPlani([blok(70), satir], olcSatir, dar);
  assert.equal(plan.sayfalar[0].sutunlar[0].length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[1].length, 1);
  assert.equal(plan.sayfalar[0].sutunlar[1][0].blok.kind, "answerLines");
  if (plan.sayfalar[0].sutunlar[1][0].blok.kind === "answerLines") {
    assert.equal(plan.sayfalar[0].sutunlar[1][0].blok.count, 8);
  }
});

test("genis soru sayfa genisliginde durur, altindakiler iki sutuna bolunur", () => {
  const olcGenis = (b: DocBlock, tam?: boolean) => (tam ? 10 : b.kind === "spacer" ? b.heightMm : 10);
  const genis: DocBlock = { kind: "spacer", heightMm: 50, tamGenislik: true };
  const plan = foyYerlesimPlani([genis, blok(80), blok(120)], olcGenis, {
    ustY: 0,
    altSinir: 200,
    maksSayfa: 3,
    sutunSayisi: 2,
  });
  const c0 = plan.sayfalar[0].sutunlar[0];
  const c1 = plan.sayfalar[0].sutunlar[1];
  assert.equal(c0[0].tamGenislik, true);
  assert.equal(c0[0].yukseklikMm, 10);
  assert.equal(c0[1].y, 10);
  assert.equal(c0[1].indeks, 1);
  assert.equal(c1[0].y, 10);
  assert.equal(c1[0].indeks, 2);
});

test("indeksler kaynak siraya sadik kalir", () => {
  const plan = foyYerlesimPlani(Array.from({ length: 7 }, () => blok(90)), olc, SECENEK);
  const hepsi = plan.sayfalar.flatMap((s) => s.sutunlar.flat()).map((x) => x.indeks);
  assert.deepEqual(hepsi, [0, 1, 2, 3, 4, 5, 6]);
});
