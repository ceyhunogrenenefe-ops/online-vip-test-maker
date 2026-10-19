import test from "node:test";
import assert from "node:assert/strict";
import { erisimKarari, koclukHesapKarari, koclukYanitKarari } from "../foy-erisim.ts";
import { herkeseAcikYol, oturumDogrula, oturumImzala } from "../oturum.ts";

test("aktif ogretmen ve super admin girebilir", () => {
  assert.equal(erisimKarari({ role: "teacher", is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "coach", roles: ["teacher"], is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "super_admin", is_active: true }), "izin");
  assert.equal(erisimKarari({ role: "admin", is_active: true }), "izin");
});

test("koclukta ogretmen kaydi olan girebilir, ogrenci ve koc giremez", () => {
  assert.equal(koclukHesapKarari({ role: "teacher", isActive: true }), "izin");
  assert.equal(koclukHesapKarari({ role: "coach", roles: ["teacher"], isActive: true }), "izin");
  assert.equal(koclukHesapKarari({ role: "student", isActive: true }), "yetkisiz");
  assert.equal(koclukHesapKarari({ role: "coach", isActive: true }), "yetkisiz");
  assert.equal(koclukHesapKarari({ role: "teacher", isActive: false }), "pasif");
});

test("ogrenci sinav linki kapinin disinda kalir", () => {
  assert.equal(herkeseAcikYol("/exam/abc"), true);
  assert.equal(herkeseAcikYol("/giris"), true);
  assert.equal(herkeseAcikYol("/api/giris"), true);
  assert.equal(herkeseAcikYol("/"), false);
  assert.equal(herkeseAcikYol("/api/soru-uret"), false);
});

test("ogretmen yaniti oturum olur, ogrenci yaniti olmaz", () => {
  const ogretmen = koclukYanitKarari({
    user: { id: "u1", email: "a@okul.com", name: "Ayşe", role: "teacher", roles: ["teacher"], isActive: true },
  });
  assert.equal(ogretmen.karar, "izin");
  assert.equal(ogretmen.yuk?.sub, "u1");
  const ogrenci = koclukYanitKarari({
    user: { id: "u2", email: "b@okul.com", role: "student", isActive: true },
  });
  assert.equal(ogrenci.karar, "yetkisiz");
  assert.equal(ogrenci.yuk, null);
});

test("oturum imzasi dogrulanir, baska sirr ile gecmez", async () => {
  const token = await oturumImzala(
    { sub: "u1", email: "a@okul.com", role: "teacher", roles: ["teacher"] },
    "gizli-anahtar"
  );
  const ok = await oturumDogrula(token, ["gizli-anahtar"]);
  assert.equal(ok?.sub, "u1");
  assert.equal(await oturumDogrula(token, ["baska"]), null);
});

test("pasif hesap ve ogrenci giremez", () => {
  assert.equal(erisimKarari({ role: "teacher", is_active: false }), "pasif");
  assert.equal(erisimKarari({ role: "student", is_active: true }), "yetkisiz");
  assert.equal(erisimKarari({ role: "coach", is_active: true }), "yetkisiz");
  assert.equal(erisimKarari(null), "yok");
});
