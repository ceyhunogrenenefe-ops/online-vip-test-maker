import test from "node:test";
import assert from "node:assert/strict";
import { anahtarCoz } from "../deneme/anahtar.ts";
import { formatBul, numaradanDers, tumTestler, baslikTesti } from "../deneme/format.ts";
import { sorulariBul, type Kelime, type SayfaVeri } from "../deneme/kesim.ts";

/** Metni kelimelere böler; harf genişliği yazı boyunun yarısı. */
function yaz(x: number, y: number, metin: string, boy = 10): Kelime[] {
  const out: Kelime[] = [];
  let cx = x;
  for (const parca of metin.split(" ")) {
    const w = parca.length * boy * 0.5;
    out.push({ metin: parca, x: cx, y, w, h: boy });
    cx += w + boy * 0.3;
  }
  return out;
}

function sayfa(no: number, kelimeler: Kelime[], bolmeX: number | null = 297): SayfaVeri {
  return { sayfa: no, genislik: 595, yukseklik: 842, kelimeler, bolmeX };
}

const LGS = tumTestler(formatBul("LGS"));
const TYT = tumTestler(formatBul("TYT"));

test("iki sütunlu sayfada sorular sütun sırasıyla kesilir", () => {
  const k = [
    ...yaz(40, 30, "TÜRKÇE TESTİ"),
    ...yaz(40, 60, "1. Aşağıdaki cümlelerin hangisinde"),
    ...yaz(55, 75, "A) bir B) iki C) üç D) dört"),
    ...yaz(40, 300, "2. Bu parçada asıl anlatılmak"),
    ...yaz(55, 315, "A) x B) y"),
    ...yaz(320, 60, "3. Hangisi yanlıştır?"),
    ...yaz(320, 400, "4. Hangisi doğrudur?"),
    ...yaz(290, 820, "Diğer sayfaya geçiniz"),
  ];
  const { sorular } = sorulariBul([sayfa(1, k)], { testler: LGS, tekTest: null });
  assert.deepEqual(sorular.map((s) => s.numara), [1, 2, 3, 4]);
  assert.ok(sorular.every((s) => s.testIndex === 0));
  const [s1, s2, s3, s4] = sorular;
  assert.ok(s1.kutu.y < 60 && s1.kutu.y + s1.kutu.h <= 300, "1. soru 2. sorunun üstünde biter");
  assert.ok(s1.kutu.x + s1.kutu.w <= 297, "sol sütun bölme çizgisini geçmez");
  assert.ok(s3.kutu.x >= 297, "3. soru sağ sütunda");
  assert.ok(s3.kutu.y + s3.kutu.h <= 400);
  assert.ok(s4.kutu.y + s4.kutu.h < 820, "son soru sayfa altlığından önce biter");
  assert.ok(s2.noKutu && s2.noKutu.w < 20, "numara kutusu yalnız '2.' kadar");
});

test("başlık testi değiştirir, her sayfada tekrar eden başlık numarayı sıfırlamaz", () => {
  const s1 = sayfa(1, [...yaz(40, 30, "TÜRKÇE"), ...yaz(40, 60, "1. Soru bir"), ...yaz(40, 400, "2. Soru iki")]);
  const s2 = sayfa(2, [...yaz(40, 30, "TÜRKÇE"), ...yaz(40, 60, "3. Soru üç"), ...yaz(320, 60, "MATEMATİK"), ...yaz(320, 90, "1. Mat bir")]);
  const { sorular } = sorulariBul([s1, s2], { testler: LGS, tekTest: null });
  assert.deepEqual(
    sorular.map((s) => [s.testIndex, s.numara]),
    [[0, 1], [0, 2], [0, 3], [4, 1]]
  );
});

test("soru içindeki girintisiz '1.' öncülü yeni soru sayılmaz", () => {
  const k = [
    ...yaz(40, 60, "5. Aşağıdakilerden hangisi"),
    ...yaz(40, 80, "1. öncül burada"),
    ...yaz(40, 95, "2. öncül burada"),
    ...yaz(40, 300, "6. Sonraki soru"),
  ];
  const { sorular } = sorulariBul([sayfa(1, k, null)], { testler: LGS, tekTest: 0 });
  assert.deepEqual(sorular.map((s) => s.numara), [5, 6]);
});

test("başlıksız PDF'te numaranın sayfa başında 1'e dönmesi sonraki teste geçer", () => {
  const s1 = sayfa(1, [...yaz(40, 60, "1. a"), ...yaz(40, 300, "2. b")], null);
  const s2 = sayfa(2, [...yaz(40, 60, "1. c")], null);
  const { sorular } = sorulariBul([s1, s2], { testler: LGS, tekTest: null });
  assert.deepEqual(sorular.map((s) => s.testIndex), [0, 0, 1]);
});

test("ortak metin grubu ayrı parça olarak kesilir, sorular gruba bağlanır", () => {
  const k = [
    ...yaz(40, 40, "1. Tek soru"),
    ...yaz(40, 200, "2. ve 3. soruları aşağıdaki metne göre cevaplayınız."),
    ...yaz(40, 220, "Uzun bir okuma parçası burada yer alır."),
    ...yaz(40, 500, "2. Metnin konusu nedir?"),
    ...yaz(320, 40, "3. Metne göre hangisi söylenemez?"),
    ...yaz(320, 300, "4. Bağımsız soru"),
  ];
  const { sorular, gruplar } = sorulariBul([sayfa(1, k)], { testler: LGS, tekTest: 0 });
  assert.deepEqual(sorular.map((s) => s.numara), [1, 2, 3, 4]);
  assert.equal(gruplar.length, 1);
  const g = gruplar[0];
  assert.deepEqual([g.ilk, g.son], [2, 3]);
  assert.equal(sorular[1].grupId, g.id);
  assert.equal(sorular[2].grupId, g.id);
  assert.equal(sorular[3].grupId, null);
  assert.ok(sorular[0].kutu.y + sorular[0].kutu.h <= 200, "1. soru talimat satırında biter");
  const parca = g.parcalar[0].kutu;
  assert.ok(parca.y > 200 && parca.y + parca.h <= 500, "parça talimattan sonra başlar, 2. sorudan önce biter");
});

test("sütuna taşan ortak metin ikinci parçayı alır", () => {
  const k = [
    ...yaz(40, 600, "5. - 6. soruları aşağıdaki metne göre cevaplayınız."),
    ...yaz(40, 620, "Metnin başı"),
    ...yaz(320, 40, "metnin devamı burada"),
    ...yaz(320, 200, "5. Soru beş"),
    ...yaz(320, 400, "6. Soru altı"),
  ];
  const { gruplar } = sorulariBul([sayfa(1, k)], { testler: LGS, tekTest: 0 });
  assert.equal(gruplar[0].parcalar.length, 2);
  assert.ok(gruplar[0].parcalar[1].kutu.x >= 297);
});

test("başlık tanıma: büyük harf, en uzun ad, talimat değil", () => {
  assert.equal(baslikTesti("SOSYAL BİLİMLER TESTİ", TYT), 1);
  assert.equal(baslikTesti("T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK", LGS), 1);
  assert.equal(baslikTesti("Türkçe dersinde", LGS), null);
  assert.equal(baslikTesti("1. Bu testte 40 soru vardır.", TYT), null);
  const ayt = tumTestler(formatBul("AYT"));
  assert.equal(baslikTesti("SOSYAL BİLİMLER-2 TESTİ", ayt), 1);
});

test("numaradan alt ders", () => {
  assert.equal(numaradanDers(TYT[1], 7), "Coğrafya");
  assert.equal(numaradanDers(TYT[3], 20), "Biyoloji");
  assert.equal(numaradanDers(TYT[0], 3), "Türkçe");
});

test("cevap anahtarı: yan yana ders sütunları", () => {
  const k = [
    ...yaz(200, 20, "CEVAP ANAHTARI"),
    ...yaz(40, 50, "TÜRKÇE"),
    ...yaz(300, 50, "MATEMATİK"),
    ...yaz(40, 70, "1. B"),
    ...yaz(300, 70, "1. D"),
    ...yaz(40, 85, "2. A"),
    ...yaz(300, 85, "2-C"),
    ...yaz(40, 200, "FEN BİLİMLERİ"),
    ...yaz(40, 220, "1.E"),
  ];
  const m = anahtarCoz(k, LGS);
  assert.equal(m.get("0:1"), "B");
  assert.equal(m.get("0:2"), "A");
  assert.equal(m.get("4:1"), "D");
  assert.equal(m.get("4:2"), "C");
  assert.equal(m.get("5:1"), "E");
});

test("cevap anahtarı: numara satırı + harf satırı tablosu", () => {
  const k = [
    ...yaz(40, 50, "TÜRKÇE"),
    ...yaz(40, 70, "1 2 3 4 5"),
    ...yaz(40, 85, "A C B D A"),
  ];
  const m = anahtarCoz(k, LGS);
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => m.get(`0:${n}`)), ["A", "C", "B", "D", "A"]);
});

test("cevap anahtarı: başlıksız, kesintisiz 1–90 numaralama testlere dağılır", () => {
  const k: Kelime[] = [];
  for (let n = 1; n <= 90; n++) k.push(...yaz(40 + Math.floor((n - 1) / 30) * 150, 40 + ((n - 1) % 30) * 20, `${n}. A`));
  const m = anahtarCoz(k, LGS);
  assert.equal(m.get("0:20"), "A");
  assert.equal(m.get("1:1"), "A", "21. soru İnkılap 1");
  assert.equal(m.get("5:20"), "A", "90. soru Fen 20");
  assert.equal(m.size, 90);
});

import { otomatikTamamla, secimDegistir } from "../deneme/secim.ts";

test("otomatik seçim: grup bütün gelir, sayı aşılmaz, az kullanılan önce", () => {
  const adaylar = [
    { id: "a", grupId: null, kullanim: 2, dogru: "A" },
    { id: "b", grupId: null, kullanim: 0, dogru: "B" },
    { id: "c", grupId: "g", kullanim: 0, dogru: "C" },
    { id: "d", grupId: "g", kullanim: 0, dogru: "D" },
    { id: "e", grupId: null, kullanim: 0, dogru: null },
  ];
  const sec = otomatikTamamla(adaylar, 3, [], new Set(), () => 0.5);
  assert.equal(sec.length, 3);
  assert.ok(sec.includes("c") && sec.includes("d"), "grup birlikte");
  assert.ok(sec.includes("b"));
  assert.ok(!sec.includes("e"), "cevapsız soru son tercih");
  const iki = otomatikTamamla(adaylar, 1, [], new Set(), () => 0.5);
  assert.equal(iki.length, 1, "2 kişilik grup 1 boşluğa sığmaz");
  assert.deepEqual(otomatikTamamla(adaylar, 2, ["a"], new Set(), () => 0.5), ["a", "b"]);
});

test("elle seçim grubu birlikte ekler ve çıkarır", () => {
  const ek = secimDegistir(["x"], { id: "c", grupId: "g" }, ["c", "d"]);
  assert.deepEqual(ek, ["x", "c", "d"]);
  assert.deepEqual(secimDegistir(ek, { id: "d", grupId: "g" }, ["c", "d"]), ["x"]);
});

import { bolmeBul, icerikSiniri } from "../deneme/piksel.ts";

test("sütun boşluğu: boş şerit, ince çizgi, üstte tam genişlik bölüm", () => {
  const W = 600;
  const iki = () => Array.from({ length: W }, (_, x) => (x > 290 && x < 310 ? 0 : x < 40 || x > 560 ? 0 : 3));
  const tam = () => Array.from({ length: W }, (_, x) => (x < 40 || x > 560 ? 0 : 3));
  const seritler = [...Array(10)].map(iki);
  assert.ok(Math.abs((bolmeBul(seritler, 30) ?? 0) - 300) < 3);
  const cizgili = seritler.map((s) => s.map((v, x) => (x === 300 ? 30 : v)));
  assert.ok(bolmeBul(cizgili, 30) !== null);
  assert.equal(bolmeBul([...Array(10)].map(tam), 30), null);
  const karisik = [...[...Array(4)].map(tam), ...[...Array(6)].map(iki)];
  assert.ok(Math.abs((bolmeBul(karisik, 30) ?? 0) - 300) < 3);
});

test("içerik sınırı beyaz kenarları atar", () => {
  const r = icerikSiniri(100, 100, (x, y) => !(x >= 20 && x < 30 && y >= 40 && y < 50), 2);
  assert.deepEqual(r, { x: 18, y: 38, w: 14, h: 14 });
});

import { kenarNumaralari } from "../deneme/piksel.ts";

test("kenar numarası: tek başına duran küçük leke bulunur, metin satırı bulunmaz", () => {
  const dolu = new Set<string>();
  const kare = (x0: number, y0: number, w: number, h: number) => {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) dolu.add(`${x},${y}`);
  };
  kare(20, 100, 25, 20); // "1."
  kare(110, 100, 300, 20); // yanındaki metin
  kare(110, 130, 300, 20);
  kare(20, 300, 30, 20); // metne bitişik satır başı ("Bu kelime...")
  kare(56, 300, 300, 20);
  kare(20, 500, 300, 200); // büyük şekil
  const r = kenarNumaralari((x, y) => dolu.has(`${x},${y}`), { x0: 0, x1: 600, y0: 0, y1: 800 }, 20);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].x, r[0].y, r[0].h], [20, 100, 20]);
});

test("cevap anahtarı: tüm şıklar yazılı, işaretli olan boyadan seçilir", () => {
  const k = [...yaz(40, 50, "1. A B C D"), ...yaz(200, 50, "2. A B C D")];
  const boyali = new Set(["1:B", "2:D"]);
  const m = anahtarCoz(k, LGS, 0, (kutu) => {
    const w = k.find((x) => x.metin.length === 1 && Math.abs(x.x + x.w / 2 - (kutu.x + kutu.w / 2)) < 1)!;
    const no = w.x < 150 ? 1 : 2;
    return boyali.has(`${no}:${w.metin}`) ? 0.6 : 0.05;
  });
  assert.equal(m.get("0:1"), "B");
  assert.equal(m.get("0:2"), "D");
  assert.equal(anahtarCoz(k, LGS, 0).size, 0, "boya bilgisi yoksa tahmin edilmez");
});

import { anahtarSayfasiMi } from "../deneme/anahtar.ts";

test("anahtar sayfası: karekod notu anahtar sayılmaz", () => {
  assert.equal(anahtarSayfasiMi([...yaz(40, 40, "Cevap anahtarı için karekodu okutunuz."), ...yaz(40, 80, "A) Bir şey B) İki şey C) Üç D) Dört")]), false);
  const k = yaz(40, 40, "CEVAP ANAHTARI");
  for (let i = 1; i <= 10; i++) k.push(...yaz(40, 50 + i * 15, `${i}. B`));
  assert.equal(anahtarSayfasiMi(k), true);
});

import { boslukSonrasiniAt } from "../deneme/piksel.ts";

test("uzun boşluktan sonraki altlık atılır", () => {
  const dolu = (y: number) => (y >= 10 && y < 50) || (y >= 200 && y < 210);
  assert.equal(boslukSonrasiniAt(220, dolu, 60), 50);
  assert.equal(boslukSonrasiniAt(220, (y) => y < 100 || (y > 130 && y < 150), 60), 150, "kısa iç boşluk korunur");
});
