import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

process.env.HAVUZ_YOL = mkdtempSync(join(tmpdir(), "havuz-"));
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

const { bankaKaydet, havuzListesi, ogeGetir, ogeKaldir, soruGorseli, soruKaydet } = await import(
  "../havuz/islem.ts"
);

const ayse = { id: "ayse", ad: "Ayşe", yonetici: false };
const mehmet = { id: "mehmet", ad: "Mehmet", yonetici: false };
const yonetici = { id: "yon", ad: "Yönetici", yonetici: true };
const gorsel = "data:image/png;base64," + Buffer.from("png-baytlari").toString("base64");

test("bir öğretmenin yüklediği soruyu herkes görür", async () => {
  await soruKaydet({ id: "s1", imageDataUrl: gorsel, createdAt: 1, pdfSourceName: "fizik.pdf" }, ayse);
  const liste = await havuzListesi();
  assert.equal(liste.sorular.length, 1);
  assert.equal(liste.sorular[0].ekleyen.ad, "Ayşe");
  assert.equal(liste.sorular[0].pdfSourceName, "fizik.pdf");
  assert.equal("imageDataUrl" in liste.sorular[0], false, "liste görsel taşımaz");
  const tam = (await ogeGetir("soru", "s1")) as { imageDataUrl: string };
  assert.equal(tam.imageDataUrl, gorsel);
  const g = await soruGorseli("s1");
  assert.equal(g.tur, "image/png");
  assert.equal(g.bayt.toString(), "png-baytlari");
});

test("ekleyen kendi sorusunu günceller, başkası değiştiremez", async () => {
  await soruKaydet({ id: "s1", imageDataUrl: gorsel, answerKey: "C" }, ayse);
  assert.equal((await havuzListesi()).sorular[0].answerKey, "C");
  const r = await soruKaydet({ id: "s1", imageDataUrl: gorsel, answerKey: "A" }, mehmet);
  assert.equal(r.durum, "baskasinin");
  const s = (await havuzListesi()).sorular[0];
  assert.equal(s.answerKey, "C");
  assert.equal(s.ekleyen.id, "ayse");
});

test("başkası silemez; ekleyen silince eski tarayıcı geri yükleyemez", async () => {
  await assert.rejects(ogeKaldir("soru", "s1", mehmet), /yalnızca ekleyen/);
  await ogeKaldir("soru", "s1", ayse);
  assert.equal((await havuzListesi()).sorular.length, 0);
  const r = await soruKaydet({ id: "s1", imageDataUrl: gorsel }, mehmet);
  assert.equal(r.durum, "silinmis");
  assert.equal((await havuzListesi()).sorular.length, 0);
  await assert.rejects(ogeGetir("soru", "s1"), /Bulunamadı/);
});

test("föy bankası ortak; yönetici herkesin kaydını silebilir", async () => {
  await bankaKaydet(
    { id: "b1", ders: "Fizik", sinif: "9", konu: "Kuvvet", tip: "question", etiket: "Soru: kuvvet", blok: { kind: "question" } },
    mehmet
  );
  const liste = await havuzListesi();
  assert.equal(liste.banka[0].etiket, "Soru: kuvvet");
  assert.equal(liste.banka[0].ekleyen.ad, "Mehmet");
  assert.deepEqual(((await ogeGetir("banka", "b1")) as { blok: unknown }).blok, { kind: "question" });
  await ogeKaldir("banka", "b1", yonetici);
  assert.equal((await havuzListesi()).banka.length, 0);
});

test("geçersiz kimlik ve görselsiz soru reddedilir", async () => {
  await assert.rejects(soruKaydet({ id: "../x", imageDataUrl: gorsel }, ayse), /Geçersiz kimlik/);
  await assert.rejects(soruKaydet({ id: "s9", imageDataUrl: "javascript:1" }, ayse), /görseli eksik/);
});
