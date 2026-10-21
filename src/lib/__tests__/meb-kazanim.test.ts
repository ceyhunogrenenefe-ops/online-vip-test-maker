import test from "node:test";
import assert from "node:assert/strict";
import { mebKazanimBul, mebKazanimlari, yaziliGrupSirasi, yaziliYeri } from "../meb-kazanim.ts";

test("7. sinif matematik satirlari resmî tablodan gelir", () => {
  const liste = mebKazanimlari("7. sınıf", "Matematik");
  assert.ok(liste.length >= 10);
  assert.ok(liste.every((s) => s.sinif === 7 && s.ders === "İlköğretim Matematik"));
  const biri = mebKazanimBul(7, "Matematik", "MAT.7.1.1");
  assert.ok(biri);
  assert.match(biri.kazanim, /^MAT\.7\.1\.1\./);
  assert.ok(biri.sinav1.some((n) => n > 0));
});

test("lise matematigi ortaokul satiriyla karismaz", () => {
  const lise = mebKazanimlari(10, "Matematik");
  assert.ok(lise.length > 0);
  assert.ok(lise.every((s) => s.ders === "Matematik" && s.sinif === 10));
  assert.equal(mebKazanimBul(10, "Matematik", "MAT.7.1.1"), null);
});

test("serbest metin resmî kazanım sayılmaz", () => {
  assert.equal(mebKazanimBul(7, "Matematik", "kesirlerde problem çözme"), null);
});

test("10. sinif felsefe yüklü tablodan secilir", () => {
  const liste = mebKazanimlari(10, "Felsefe");
  assert.ok(liste.length >= 5);
  assert.ok(liste.every((s) => s.ders === "Felsefe"));
});

test("geometri tablosu bu pakette yok", () => {
  assert.equal(mebKazanimlari(9, "Geometri").length, 0);
});

test("kazanimlar 1. yazili ve 2. yazili olarak ayrilir", () => {
  const liste = mebKazanimlari(7, "Matematik");
  const biri = mebKazanimBul(7, "Matematik", "MAT.7.1.1");
  assert.equal(yaziliYeri(biri!), "1");
  assert.ok(liste.some((s) => yaziliYeri(s) === "2"));
  assert.deepEqual(yaziliGrupSirasi("2. Yazılı")[0], "2. Yazılı");
  assert.deepEqual(yaziliGrupSirasi("1. Yazılı")[0], "1. Yazılı");
});

test("8. sinif inkılap satirlari sosyal bilgiler dosyasindan okunur", () => {
  const liste = mebKazanimlari(8, "T.C. İnkılap Tarihi ve Atatürkçülük");
  assert.ok(liste.some((s) => s.kod.startsWith("İTA.8")));
  assert.equal(mebKazanimlari(5, "T.C. İnkılap Tarihi ve Atatürkçülük").length, 0);
});
