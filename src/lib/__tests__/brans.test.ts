import test from "node:test";
import assert from "node:assert/strict";
import { bransOturumu, bransSecenekleri, oranlaDagit } from "../deneme/brans.ts";
import { formatBul } from "../deneme/format.ts";

test("LGS branş seçenekleri her test için bir tane", () => {
  const s = bransSecenekleri(formatBul("LGS"));
  assert.deepEqual(
    s.map((x) => x.ad),
    ["Türkçe", "T.C. İnkılap Tarihi ve Atatürkçülük", "Din Kültürü ve Ahlak Bilgisi", "İngilizce", "Matematik", "Fen Bilimleri"]
  );
});

test("TYT çok dersli testlerde alt ders seçenekleri de var", () => {
  const s = bransSecenekleri(formatBul("TYT")).map((x) => x.ad);
  assert.ok(s.includes("Fen Bilimleri"));
  assert.ok(s.includes("Fen Bilimleri › Fizik"));
  assert.ok(s.includes("Sosyal Bilimler › Tarih"));
});

test("LGS Türkçe 20 ve 40 soruluk branş denemesi", () => {
  const f = formatBul("LGS");
  const o20 = bransOturumu(f, { test: "Türkçe", ders: null }, 20);
  assert.equal(o20.ad, "Türkçe Branş Denemesi");
  assert.deepEqual(o20.testler, [{ ad: "Türkçe", dersler: [{ ad: "Türkçe", adet: 20 }] }]);
  assert.equal(o20.sureDakika, 30); // 75 dk / 50 soru = 1.5 dk/soru
  const o40 = bransOturumu(f, { test: "Türkçe", ders: null }, 40);
  assert.equal(o40.testler[0].dersler[0].adet, 40);
  assert.equal(o40.sureDakika, 60);
});

test("TYT Fen 40 soru alt derslere oranla dağılır", () => {
  const o = bransOturumu(formatBul("TYT"), { test: "Fen Bilimleri", ders: null }, 40);
  assert.deepEqual(o.testler[0].dersler, [
    { ad: "Fizik", adet: 14 },
    { ad: "Kimya", adet: 14 },
    { ad: "Biyoloji", adet: 12 },
  ]);
});

test("TYT Fizik branşı havuzda Fen Bilimleri testinden seçer, başlıkta Fizik yazar", () => {
  const o = bransOturumu(formatBul("TYT"), { test: "Fen Bilimleri", ders: "Fizik" }, 20);
  assert.deepEqual(o.testler, [{ ad: "Fen Bilimleri", baslik: "Fizik", dersler: [{ ad: "Fizik", adet: 20 }] }]);
});

test("oranlaDagit toplamı korur", () => {
  const d = oranlaDagit([{ ad: "a", adet: 5 }, { ad: "b", adet: 5 }, { ad: "c", adet: 5 }, { ad: "d", adet: 5 }], 30);
  assert.equal(d.reduce((a, x) => a + x.adet, 0), 30);
});

test("bilinmeyen test hata verir", () => {
  assert.throws(() => bransOturumu(formatBul("LGS"), { test: "Fizik", ders: null }, 20));
});
