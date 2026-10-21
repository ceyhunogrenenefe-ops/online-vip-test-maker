import test from "node:test";
import assert from "node:assert/strict";
import { secimiGenislet, secimiUygula } from "../kirp-secim.ts";

const sayfa = { w: 1000, h: 800 };
const kutu = { x: 100, y: 80, width: 200, height: 120 };

test("dogu kenari secimi genisletir", () => {
  const n = secimiUygula(kutu, 40, 0, "e", sayfa.w, sayfa.h);
  assert.equal(n.x, 100);
  assert.equal(n.width, 240);
  assert.equal(n.height, 120);
});

test("bati kenari secimi daraltir", () => {
  const n = secimiUygula(kutu, 30, 0, "w", sayfa.w, sayfa.h);
  assert.equal(n.x, 130);
  assert.equal(n.width, 170);
});

test("kose hem eni hem boyu degistirir", () => {
  const n = secimiUygula(kutu, 20, 15, "se", sayfa.w, sayfa.h);
  assert.equal(n.width, 220);
  assert.equal(n.height, 135);
  assert.equal(n.x, 100);
  assert.equal(n.y, 80);
});

test("tasima secimin olcusunu korur", () => {
  const n = secimiUygula(kutu, 50, -20, "tasi", sayfa.w, sayfa.h);
  assert.deepEqual(n, { x: 150, y: 60, width: 200, height: 120 });
});

test("secim sayfa disina tasmaz", () => {
  const n = secimiUygula(kutu, 5000, 0, "e", sayfa.w, sayfa.h);
  assert.equal(n.x + n.width, sayfa.w);
  assert.ok(n.width >= 12);
});

test("genislet ve daralt her kenari birlikte oynatir", () => {
  const acik = secimiGenislet(kutu, 10, sayfa.w, sayfa.h);
  assert.deepEqual(acik, { x: 90, y: 70, width: 220, height: 140 });
  const kapali = secimiGenislet(acik, -10, sayfa.w, sayfa.h);
  assert.deepEqual(kapali, kutu);
});
