import test from "node:test";
import assert from "node:assert/strict";
import { anahtarBicimi } from "../anahtar-bicimi.ts";

const TB = String.fromCharCode(92);
const ORNEK = "sk-ant-api03-" + "A1b2C3d4E5f6G7h8".repeat(4);

test("saglikli anahtari dogru ozetler", () => {
  const r = anahtarBicimi(ORNEK);
  assert.match(r, /uzunluk=77/);
  assert.match(r, /onek=sk-ant-/);
  assert.doesNotMatch(r, /gecersiz-karakter/);
});

test("ozet anahtarin HICBIR parcasini icermez", () => {
  const r = anahtarBicimi(ORNEK);
  // Anahtardan 8 karakterlik her dilim ozette gecmemeli
  for (let i = 0; i + 8 <= ORNEK.length; i++) {
    const dilim = ORNEK.slice(i, i + 8);
    if (dilim === "sk-ant-a") continue; // onek bayragi kasitli
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
