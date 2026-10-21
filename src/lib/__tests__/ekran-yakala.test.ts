import test from "node:test";
import assert from "node:assert/strict";
import { ekranHatasi, ekranPaylasimiVar, ekranVideoAyari, EKRAN_YOK } from "../ekran-yakala.ts";

test("sunucuda ekran paylasimi yoktur", () => {
  assert.equal(ekranPaylasimiVar(), false);
});

test("yuksek cozunurluklu ekran paylasimi cihaz pikseli ister", () => {
  const ayar = ekranVideoAyari({ width: 1920, height: 1080, dpr: 2 });
  assert.equal(ayar.width.ideal, 3840);
  assert.equal(ayar.height.ideal, 2160);
  assert.equal(ayar.resizeMode, "none");
});

test("iptal edilen pencere secimi sade mesaj verir", () => {
  const iptal = new DOMException("denied", "NotAllowedError");
  assert.equal(ekranHatasi(iptal), "Pencere seçimi iptal edildi.");
  assert.match(EKRAN_YOK, /ekran görüntüsünü/);
});
