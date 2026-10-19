import test from "node:test";
import assert from "node:assert/strict";
import {
  egitimYillari,
  kapakMetni,
  kapakSatirlari,
  kunyeEskiden,
  varsayilanKunye,
} from "../foy-kunye.ts";

const TARIH = new Date("2026-10-19T12:00:00+03:00");

test("egitim yillari 2025ten baslar ve icinde bulunulan yildan sonrakileri uretir", () => {
  assert.deepEqual(egitimYillari(TARIH), [
    "2025–2026",
    "2026–2027",
    "2027–2028",
    "2028–2029",
    "2029–2030",
  ]);
});

test("kapak basligi secimlerden uretilir", () => {
  const k = varsayilanKunye(TARIH);
  k.egitimYili = "2026–2027";
  k.sinif = 7;
  k.brans = "Matematik";
  k.donem = "1. Dönem";
  k.yazili = "1. Yazılı";
  k.tur = "Yazılıya Hazırlık";
  assert.equal(
    kapakMetni(k),
    [
      "ONLINE VIP DERSHANE",
      "2026–2027 EĞİTİM ÖĞRETİM YILI",
      "7. SINIF MATEMATİK",
      "1. DÖNEM 1. YAZILIYA HAZIRLIK FÖYÜ",
    ].join("\n")
  );
  assert.equal(kapakSatirlari(k)[2], "7. SINIF MATEMATİK");
});

test("turkce i harfi kapakta I olmaz", () => {
  const k = varsayilanKunye(TARIH);
  k.brans = "Fizik";
  k.konu = "Kaldırma kuvveti";
  assert.match(kapakSatirlari(k)[2], /FİZİK/);
});

test("eski serbest metin kunye secime doner", () => {
  const k = kunyeEskiden(
    { sinif: "9. SINIF", brans: "FİZİK", konu: "Basınç", tur: "Yazılıya Hazırlık Föyü" },
    TARIH
  );
  assert.equal(k.sinif, 9);
  assert.equal(k.brans, "FİZİK");
  assert.equal(k.konu, "Basınç");
  assert.equal(k.tur, "Yazılıya Hazırlık");
  assert.equal(k.egitimYili, "2026–2027");
});
