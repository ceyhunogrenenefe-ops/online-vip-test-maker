import test from "node:test";
import assert from "node:assert/strict";
import { guvenliPdfOlcegi } from "../pdf-olcek.ts";

test("A4 sayfada istenen netlik korunur", () => {
  assert.equal(guvenliPdfOlcegi(3, 595, 842), 3);
});

test("dev sayfa tuval sınırına indirilir", () => {
  const olcek = guvenliPdfOlcegi(3, 4000, 6000);
  assert.ok(olcek < 3);
  assert.ok(Math.max(4000, 6000) * olcek <= 8192 + 0.01);
  assert.ok(4000 * olcek * 6000 * olcek <= 16_000_000 + 1);
});
