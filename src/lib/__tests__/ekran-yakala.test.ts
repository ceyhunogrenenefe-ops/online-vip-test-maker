import test from "node:test";
import assert from "node:assert/strict";
import { ekranHatasi, ekranPaylasimiVar, EKRAN_YOK } from "../ekran-yakala.ts";

test("sunucuda ekran paylasimi yoktur", () => {
  assert.equal(ekranPaylasimiVar(), false);
});

test("iptal edilen pencere secimi sade mesaj verir", () => {
  const iptal = new DOMException("denied", "NotAllowedError");
  assert.equal(ekranHatasi(iptal), "Pencere seçimi iptal edildi.");
  assert.match(EKRAN_YOK, /ekran görüntüsünü/);
});
