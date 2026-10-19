import test from "node:test";
import assert from "node:assert/strict";
import { anahtarBicimi, anahtarReddi } from "../anahtar-bicimi.ts";

const TB = String.fromCharCode(92);
const ORNEK = "sk-ant-api03-" + "A1b2C3d4E5f6G7h8".repeat(4);

test("saglikli anahtari dogru ozetler", () => {
  const r = anahtarBicimi(ORNEK);
  assert.match(r, /uzunluk=77/);
  assert.match(r, /onek=sk-ant-api03-/);
  assert.doesNotMatch(r, /gecersiz-karakter/);
});

test("ozet anahtarin HICBIR parcasini icermez", () => {
  const r = anahtarBicimi(ORNEK);
  // Anahtardan 8 karakterlik her dilim ozette gecmemeli
  for (let i = 0; i + 8 <= ORNEK.length; i++) {
    const dilim = ORNEK.slice(i, i + 8);
    if ("sk-ant-api03-".includes(dilim)) continue; // tur oneki kasitli
    assert.ok(!r.includes(dilim), `ozet anahtar parcasi sizdirdi: ${dilim}`);
  }
});

test("bastaki/sondaki bosluk bildirilir", () => {
  assert.match(anahtarBicimi("  " + ORNEK + "  "), /basta\/sonda-bosluk-vardi/);
});

test("satir sonu gibi gecersiz karakterler kod numarasiyla bildirilir", () => {
  const r = anahtarBicimi("sk-ant-abc" + String.fromCharCode(10) + "def");
  assert.match(r, /gecersiz-karakter=1/);
  assert.match(r, /ilk-gecersiz-kod=10/);
});

test("tirnakla yapistirilmis anahtar yakalanir", () => {
  assert.match(anahtarBicimi('"' + ORNEK + '"'), /tirnak-sarili/);
});

test("degisken adiyla birlikte yapistirma yakalanir", () => {
  assert.match(anahtarBicimi("ANTHROPIC_API_KEY=" + ORNEK), /degisken-adi-da-yapistirilmis/);
});

test("beklenmeyen onek bildirilir", () => {
  assert.match(anahtarBicimi("abc123"), /onek=beklenmeyen/);
});

test("tanimsiz deger cokmez", () => {
  assert.match(anahtarBicimi(undefined), /uzunluk=0/);
});

test("ters bolu iceren deger gecersiz sayilmaz (yazdirilabilir ascii)", () => {
  assert.doesNotMatch(anahtarBicimi("sk-ant-" + TB + "x"), /gecersiz-karakter/);
});

test("yonetici anahtari soru uretimine girmeden reddedilir", () => {
  const mesaj = anahtarReddi("sk-ant-admin01-" + "x".repeat(95));
  assert.ok(mesaj);
  assert.match(mesaj, /sk-ant-admin/);
  assert.match(mesaj, /sk-ant-api03-/);
  assert.equal(anahtarReddi("sk-ant-api03-" + "x".repeat(95)), null);
  assert.match(anahtarReddi("sk-ant-oat01-" + "y".repeat(90)) || "", /sk-ant-oat/);
});

test("tur oneki Console anahtarini yonetici anahtarindan ayirir", () => {
  const api = anahtarBicimi("sk-ant-api03-" + "x".repeat(95));
  const admin = anahtarBicimi("sk-ant-admin01-" + "x".repeat(95));
  const oat = anahtarBicimi("sk-ant-oat01-" + "x".repeat(95));
  assert.match(api, /onek=sk-ant-api03-/);
  assert.match(admin, /onek=sk-ant-admin01-/);
  assert.match(oat, /onek=sk-ant-oat01-/);
});

test("tur oneki gizli bolumden HICBIR SEY almaz", () => {
  const gizli = "ZZZZZZZZZZZZZZZZZZZZ";
  const r = anahtarBicimi("sk-ant-api03-" + gizli);
  assert.ok(!r.includes("Z"), "gizli bolumden karakter sizdi: " + r);
});

test("cok uzun tur segmenti kirpilir", () => {
  const r = anahtarBicimi("sk-ant-" + "A".repeat(40) + "-gizli");
  const m = /onek=([^,]+)/.exec(r);
  assert.ok(m && m[1].length <= 21, "onek kirpilmadi: " + (m && m[1]));
});

test("tiresiz sk-ant- degeri cokmez", () => {
  assert.match(anahtarBicimi("sk-ant-abc"), /onek=sk-ant-\(tur-yok\)/);
});
