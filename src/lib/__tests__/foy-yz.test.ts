import test from "node:test";
import assert from "node:assert/strict";
import { jsonAyikla, sorulariDogrulaGenis, yzKaliteUyarilari } from "../soru-uret-ayristir.ts";
import { applyEnhanceToImageData, DEFAULT_ENHANCE } from "../image-enhance.ts";

test("acik uclu soruda bos cevap korunur, uydurulmaz", () => {
  const sorular = sorulariDogrulaGenis(
    [{ stem: "3/4 + 1/2 işleminin sonucu nedir?", options: [], answer: "", explanation: "" }],
    "Açık uçlu"
  );
  assert.equal(sorular.length, 1);
  assert.equal(sorular[0].answer, "");
  assert.equal(sorular[0].options.length, 0);
});

test("coktan secmelide sikla uyusmayan cevap atilir", () => {
  assert.throws(() =>
    sorulariDogrulaGenis(
      [
        {
          stem: "Hangisi çifttir?",
          options: [
            { label: "A", text: "3" },
            { label: "B", text: "4" },
            { label: "C", text: "5" },
          ],
          answer: "D",
        },
      ],
      "Çoktan seçmeli"
    )
  );
});

test("kalite notu MEB uyumunu dogrulanmis saymaz", () => {
  const notlar = yzKaliteUyarilari([
    { stem: "Bir soru kökü yeterince uzun.", options: [], answer: "", explanation: "" },
  ]);
  assert.ok(notlar.some((n) => n.includes("resmî tabloda yok")));
  assert.ok(notlar.some((n) => n.includes("uydurmadı")));
});

test("resmî tablodan seçilen çıktı onaylı soru sayılmaz", () => {
  const notlar = yzKaliteUyarilari(
    [{ stem: "Bir soru kökü yeterince uzun.", options: [], answer: "4", explanation: "" }],
    true
  );
  assert.ok(notlar.some((n) => n.includes("konu soru dağılım tablosunda kayıtlı")));
  assert.ok(notlar.some((n) => n.includes("onaylanmadı")));
});

test("eksik virgul ve ic tirnak yuzunden kirilan model jsonu okunur", () => {
  const bozuk = `[
  {
    "stem": "Hangisi "doğru" dur? Kök yeterince uzun.",
    "options": []
    "answer": ""
    "explanation": "kısa çözüm"
  }
]`;
  assert.throws(() => JSON.parse(bozuk));
  const veri = jsonAyikla(bozuk) as { stem: string; answer: string; explanation: string }[];
  assert.equal(veri.length, 1);
  assert.match(veri[0].stem, /doğru/);
  assert.equal(veri[0].answer, "");
  assert.equal(veri[0].explanation, "kısa çözüm");
});

test("fotokopi zemini beyazlatir ve rengi griye cevirir", () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 250, 250, 250, 255]);
  const img = { data, width: 2, height: 1 } as ImageData;
  applyEnhanceToImageData(img, { ...DEFAULT_ENHANCE, photocopy: true, sharpness: 0 });
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
  assert.equal(data[4], 255);
  assert.equal(data[5], 255);
  assert.equal(data[6], 255);
});
