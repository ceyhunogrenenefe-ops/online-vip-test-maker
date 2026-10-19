import test from "node:test";
import assert from "node:assert/strict";
import { erisimKarari } from "../foy-erisim.ts";

test("aktif ogretmen ve super admin girebilir", () => {
  assert.equal(erisimKarari({ role: "teacher", is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "coach", roles: ["teacher"], is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "super_admin", is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "admin", is_active: true }), "izin");
});

test("pasif hesap ve ogrenci giremez", () => {
  assert.equal(erisimKarari({ role: "teacher", is_active: false }), "pasif");
  assert.equal(erisimKarari({ role: "student", is_active: true }), "yetkisiz");
  assert.equal(erisimKarari({ role: "coach", is_active: true }), "yetkisiz");
  assert.equal(erisimKarari(null), "yok");
});
