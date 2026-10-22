import test from "node:test";
import assert from "node:assert/strict";
import { baskiPikseli, gorselButcesi, PDF_SINIR_BAYT, veriBayt } from "../pdf-gorsel.ts";

test("tek soru neredeyse tum 40 MB payi kullanabilir", () => {
  assert.equal(gorselButcesi(1), PDF_SINIR_BAYT - 2 * 1024 * 1024);
});

test("paylarin toplami 40 MB tavani asmaz", () => {
  for (const n of [1, 20, 100, 400]) {
    assert.ok(gorselButcesi(n) * n <= PDF_SINIR_BAYT - 2 * 1024 * 1024);
    assert.ok(gorselButcesi(n) < gorselButcesi(1) || n === 1);
  }
});

test("buyuk ekran goruntusu baski kutusuna iner, kucuk olan buyumaz", () => {
  const kucuk = baskiPikseli(80, 40, 160, 3000, 1500);
  assert.ok(kucuk.w < 3000);
  assert.ok(kucuk.h < 1500);
  assert.equal(baskiPikseli(80, 40, 160, 100, 50).w, 100);
});

test("data url bayti base64 govdesinden okunur", () => {
  assert.equal(veriBayt("data:image/jpeg;base64,abcd"), 3);
});
