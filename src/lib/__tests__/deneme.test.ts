import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { anahtarOku, ayikla, cevaplariEsle } from "../deneme/ayikla.ts";
import { karisikDenemePdf } from "../deneme/ornek-pdf.ts";
import { satirlaraBol, sinavSatirlari } from "../deneme/pdf-satir.ts";
import { depoOku } from "../deneme/depo.ts";
import {
  denemeOlustur,
  denemeYayinla,
  pdfEkle,
  sinavBasla,
  sinavTeslim,
  smsYeniden,
} from "../deneme/islem.ts";
import type { Bolum, SayfaGirdi, Sik } from "../deneme/model.ts";
import { puanla } from "../deneme/puan.ts";
import { soruSec } from "../deneme/sec.ts";
import { smsMetni } from "../deneme/sms-metin.ts";
import { telefonKarari } from "../deneme/telefon.ts";
import { sayiYazi } from "../deneme/turkce.ts";

function sayfa(satirlar: string[], no = 1, ocr = false, guven = 96): SayfaGirdi {
  return {
    sayfa: no,
    genislik: 595,
    yukseklik: 842,
    ocr,
    satirlar: satirlar.map((metin, i) => ({
      metin,
      x: 48,
      y: 48 + i * 18,
      w: 420,
      h: 14,
      guven: ocr ? guven : undefined,
    })),
  };
}

const KARISIK = [
  sayfa([
    "TÜRKÇE",
    "1-3. soruları aşağıdaki parçaya göre cevaplayınız.",
    "Ali her sabah erken kalkar ve okula yürüyerek gider.",
    "Akşamları kitap okur.",
    "1. Parçada Ali okula nasıl gider?",
    "A) Koşarak",
    "B) Yürüyerek",
    "C) Servisle",
    "D) Bisikletle",
    "2. Ali akşamları ne yapar?",
    "A) Kitap okur",
    "B) Yüzer",
    "C) Uyur",
    "D) Koşar",
    "3. Parçaya göre Ali sabahları nasıldır?",
    "A) Geç kalır",
    "B) Hiç kalkmaz",
    "C) Erken kalkar",
    "D) Evde kalır",
    "T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK",
    "1. TBMM hangi yıl açıldı?",
    "A) 1919",
    "B) 1923",
    "C) 1920",
    "D) 1938",
  ]),
  sayfa(
    [
      "MATEMATİK",
      "1. 2x + 6 = 12 ise x kaçtır?",
      "A) 2",
      "B) 3",
      "C) 4",
      "D) 6",
      "FEN BİLİMLERİ",
      "1. Fotosentez için gerekli ışık kaynağı hangisidir?",
      "A) Ay",
      "B) Güneş",
      "C) Rüzgar",
      "D) Kaya",
      "CEVAP ANAHTARI",
      "Türkçe: 1-B 2-A 3-C",
      "T.C. İnkılap Tarihi ve Atatürkçülük: 1-C",
      "Matematik: 1-B",
      "Fen Bilimleri: 1-B",
    ],
    2
  ),
];

test("karışık sayfa derslere ayrılır, grubu ve anahtarı korur", () => {
  const sorular = ayikla(KARISIK).filter((s) => !s.inceleme);
  assert.equal(sorular.length, 6);
  const turkce = sorular.filter((s) => s.ders === "Türkçe");
  assert.equal(turkce.length, 3);
  assert.ok(turkce.every((s) => s.grupId && s.ortakMetin?.includes("Ali her sabah")));
  assert.equal(turkce[0].dogru, "B");
  assert.equal(turkce[1].dogru, "A");
  assert.equal(turkce[2].dogru, "C");
  assert.equal(turkce[0].secenekler.B, "Yürüyerek");
  const tarih = sorular.find((s) => s.ders.startsWith("T.C."));
  assert.equal(tarih?.numara, 1);
  assert.equal(tarih?.dogru, "C");
  assert.equal(sorular.find((s) => s.ders === "Matematik")?.dogru, "B");
  assert.equal(sorular.find((s) => s.ders === "Matematik")?.matematikVar, true);
  assert.equal(sorular.find((s) => s.ders === "Fen Bilimleri")?.dogru, "B");
});

test("ayrılamayan kesit incelemeye düşer", () => {
  const sorular = ayikla([
    sayfa([
      "Bu sayfada numara yok ve seçenek de yok.",
      "Öğrenciler bahçede oturup uzun uzun konuştular, kimse soru yazmamış.",
    ]),
  ]);
  assert.equal(sorular.length, 1);
  assert.equal(sorular[0].inceleme, true);
  assert.match(sorular[0].incelemeNeden || "", /güvenle ayrılamadı/);
});

test("taranmış sayfada bozuk matematik yayımlanacak kadar güvenilmez", () => {
  const sorular = ayikla([
    sayfa(
      [
        "MATEMATİK",
        "1. 2x 4* 3y — 12 denklemini çözünüz",
        "A) 1",
        "B) 2",
        "C) 3",
        "D) 4",
      ],
      1,
      true,
      40
    ),
  ]);
  assert.equal(sorular.length, 1);
  assert.equal(sorular[0].inceleme, true);
  assert.equal(sorular[0].matematikVar, true);
  assert.match(sorular[0].incelemeNeden || "", /OCR/);
});

test("aynı kök iki kez seçilmez, eksik ders sayılır", () => {
  const ham = ayikla(KARISIK).filter((s) => !s.inceleme);
  const havuz = ham.map((s, i) => ({
    ...s,
    id: `q${i}`,
    pdfId: "p1",
    gorsel: null,
    ortakGorsel: null,
  }));
  havuz.push({ ...havuz[0], id: "kopya" });
  const secim = soruSec(
    havuz,
    [
      {
        id: "sozel",
        ad: "Sözel",
        sureDakika: 20,
        dersler: [
          { ders: "Türkçe", adet: 3 },
          { ders: "İngilizce", adet: 2 },
        ],
      },
    ],
    ["p1"]
  );
  const turkce = secim.sorular.filter((s) => s.ders === "Türkçe");
  assert.equal(turkce.length, 3);
  assert.equal(new Set(turkce.map((s) => s.soruId)).size, 3);
  assert.equal(secim.eksikler.length, 1);
  assert.equal(secim.eksikler[0].ders, "İngilizce");
  assert.equal(secim.eksikler[0].bulunan, 0);
  assert.equal(secim.eksikler[0].gereken, 2);
  const kesik = soruSec(
    [0, 1].map((i) => ({
      ...havuz[0],
      id: `kesik-${i}`,
      metin: "",
      gorsel: "data:image/jpeg;base64,aa",
    })),
    [{ id: "sozel", ad: "Sözel", sureDakika: 20, dersler: [{ ders: "Türkçe", adet: 2 }] }],
    ["p1"]
  );
  assert.equal(kesik.sorular.length, 2);
});

test("iki sütun ayrı soru diye kesilir", () => {
  const satirlar = sinavSatirlari(
    [
      { metin: "TÜRKÇE", x: 40, y: 30, w: 400, h: 14 },
      { metin: "1.", x: 36, y: 70, w: 14, h: 12 },
      { metin: "Ali okula yürür.", x: 54, y: 70, w: 160, h: 12 },
      { metin: "A) Koşarak", x: 54, y: 92, w: 90, h: 12 },
      { metin: "B) Yürüyerek", x: 54, y: 110, w: 100, h: 12 },
      { metin: "C) Servisle", x: 54, y: 128, w: 90, h: 12 },
      { metin: "D) Bisikletle", x: 54, y: 146, w: 100, h: 12 },
      { metin: "2.", x: 320, y: 70, w: 14, h: 12 },
      { metin: "Hava güneşlidir.", x: 338, y: 70, w: 150, h: 12 },
      { metin: "A) Evet", x: 338, y: 92, w: 70, h: 12 },
      { metin: "B) Hayır", x: 338, y: 110, w: 70, h: 12 },
      { metin: "C) Belki", x: 338, y: 128, w: 70, h: 12 },
      { metin: "D) Asla", x: 338, y: 146, w: 70, h: 12 },
    ],
    595
  );
  const sorular = ayikla([{ sayfa: 1, genislik: 595, yukseklik: 400, ocr: false, satirlar }]).filter((s) => s.numara);
  assert.equal(sorular.length, 2);
  assert.equal(sorular[0].numara, 1);
  assert.match(sorular[0].metin, /Ali/);
  assert.doesNotMatch(sorular[0].metin, /Hava/);
  assert.equal(sorular[1].numara, 2);
  assert.ok(sorular[0].kutu.x + sorular[0].kutu.w <= sorular[1].kutu.x + 10);
});

test("yüklenen cevap anahtarı ders ve numarayla eşleşir", () => {
  const kayit = anahtarOku(`TÜRKÇE
BAC
MATEMATİK
1-C
2B`);
  assert.deepEqual(
    kayit.map((k) => `${k.ders}:${k.no}${k.sik}`),
    ["Türkçe:1B", "Türkçe:2A", "Türkçe:3C", "Matematik:1C", "Matematik:2B"]
  );
  const eslesen = cevaplariEsle(
    [
      { id: "t1", ders: "Türkçe", numara: 1 },
      { id: "t2", ders: "Türkçe", numara: 2 },
      { id: "m1", ders: "Matematik", numara: 1 },
      { id: "f1", ders: "Fen Bilimleri", numara: 1 },
    ],
    kayit
  );
  assert.deepEqual(eslesen, [
    { id: "t1", dogru: "B" },
    { id: "t2", dogru: "A" },
    { id: "m1", dogru: "C" },
  ]);
});

test("net yanlış cezasını ders ders uygular", () => {
  const ham = ayikla(KARISIK).filter((s) => !s.inceleme);
  const havuz = new Map(
    ham.map((s, i) => {
      const soru = { ...s, id: `q${i}`, pdfId: "p", gorsel: null, ortakGorsel: null };
      return [soru.id, soru] as const;
    })
  );
  const secilen = [...havuz.values()].map((s, i) => ({
    soruId: s.id,
    bolumId: "b",
    ders: s.ders,
    sira: i + 1,
  }));
  const cevaplar: Record<string, Sik> = {};
  for (const s of havuz.values()) {
    if (s.ders === "Matematik") cevaplar[s.id] = "A";
    else if (s.ders === "Fen Bilimleri") continue;
    else if (s.dogru) cevaplar[s.id] = s.dogru;
  }
  const puan = puanla(secilen, havuz, cevaplar, 1 / 3);
  assert.equal(puan.dogru, 4);
  assert.equal(puan.yanlis, 1);
  assert.equal(puan.bos, 1);
  assert.equal(puan.net, 3.67);
  assert.equal(puan.dersler.find((d) => d.ders === "Matematik")?.net, -0.33);
  assert.equal(
    smsMetni({ ad: "Ada", soyad: "Yılmaz", deneme: "Karışık Deneme", ...puan }),
    "Online VIP Dershane | Ada Yılmaz, Karışık Deneme sınavını tamamladı. Doğru 4, yanlış 1, boş 1, net 3,67."
  );
  assert.equal(sayiYazi(3), "3");
});

test("kayıtlı veli numarası alınır, çakışmada numara istenir", () => {
  const kayitlar = [
    { id: "1", ad: "Ada Yılmaz", telefon: "05551110011", veliTelefon: "05552220022" },
    { id: "2", ad: "Ada Yılmaz", telefon: "05553330033", veliTelefon: "05554440044" },
  ];
  const tek = telefonKarari({
    ad: "Ada",
    soyad: "Yılmaz",
    alici: "veli",
    kayitlar: [kayitlar[0]],
  });
  assert.equal(tek.gerekli, false);
  assert.equal(tek.kaynak, "veli");
  assert.equal(tek.telefon, "+905552220022");
  const cok = telefonKarari({ ad: "Ada", soyad: "Yılmaz", alici: "ogrenci", kayitlar });
  assert.equal(cok.gerekli, true);
  const yok = telefonKarari({
    ad: "Yeni",
    soyad: "Öğrenci",
    alici: "veli",
    kayitlar,
    girilen: "05550001122",
  });
  assert.equal(yok.gerekli, false);
  assert.equal(yok.kaynak, "giris");
});

test("teslim tek sonuç ve tek SMS yazar, tekrar basmak ikinci kayıt açmaz", async () => {
  process.env.DENEME_DEPO_YOL = join(mkdtempSync(join(tmpdir(), "deneme-")), "depo.json");
  process.env.DENEME_SMS_KAYIT = "1";
  delete process.env.DENEME_OGRENCI_JSON;

  const ham = ayikla(KARISIK).filter((s) => !s.inceleme);
  await pdfEkle({
    ad: "karisik.pdf",
    sayfaSayisi: 2,
    sorular: ham.map((soru) => ({ soru, gorsel: null, ortakGorsel: null })),
  });
  const bolumler: Bolum[] = [
    {
      id: "sozel",
      ad: "Sözel",
      sureDakika: 30,
      dersler: [
        { ders: "Türkçe", adet: 3 },
        { ders: "T.C. İnkılap Tarihi ve Atatürkçülük", adet: 1 },
      ],
    },
    {
      id: "sayisal",
      ad: "Sayısal",
      sureDakika: 30,
      dersler: [
        { ders: "Matematik", adet: 1 },
        { ders: "Fen Bilimleri", adet: 1 },
      ],
    },
  ];
  const olusan = await denemeOlustur({
    ad: "Karışık Deneme",
    yanlisCezasi: 1 / 3,
    smsAlici: "veli",
    bolumler,
    pdfIdler: [(await depoOku()).pdfler[0].id],
  });
  assert.equal(olusan.eksikler.length, 0);
  await denemeYayinla(olusan.deneme.id);
  const bas = await sinavBasla({ kod: olusan.deneme.kod, ad: "Ada", soyad: "Yılmaz", telefon: "05551112233" });
  assert.equal(bas.telefonGerekli, false);
  if (!("oturumId" in bas) || !bas.oturumId) throw new Error("oturum açılmadı");

  const depo = await depoOku();
  const deneme = depo.denemeler[0];
  const cevaplar: Record<string, Sik> = {};
  for (const sec of deneme.sorular) {
    const soru = depo.sorular.find((s) => s.id === sec.soruId);
    if (!soru?.dogru) continue;
    cevaplar[sec.soruId] = sec.ders === "Matematik" ? "A" : sec.ders === "Fen Bilimleri" ? ("" as Sik) : soru.dogru;
  }
  delete cevaplar[deneme.sorular.find((s) => s.ders === "Fen Bilimleri")!.soruId];

  const ilk = await sinavTeslim(bas.oturumId, cevaplar);
  assert.equal(ilk.ayni, false);
  assert.equal(ilk.sonuc?.dogru, 4);
  assert.equal(ilk.sonuc?.yanlis, 1);
  assert.equal(ilk.sonuc?.bos, 1);
  assert.equal(ilk.sonuc?.net, 3.67);
  assert.equal(ilk.sms.length, 1);
  assert.equal(ilk.sms[0].durum, "gonderildi");
  assert.match(ilk.sms[0].metin, /Doğru 4, yanlış 1, boş 1, net 3,67/);
  const mat = ilk.karsilastirma.find((k) => k.ders === "Matematik");
  assert.equal(mat?.verilen, "A");
  assert.equal(mat?.dogru, "B");

  const tekrar = await sinavTeslim(bas.oturumId, { ...cevaplar, [mat!.soruId]: "B" });
  assert.equal(tekrar.ayni, true);
  assert.equal(tekrar.sonuc?.net, 3.67);
  assert.equal(tekrar.sms.length, 1);
  assert.equal((await depoOku()).oturumlar.length, 1);

  delete process.env.DENEME_SMS_KAYIT;
  const bas2 = await sinavBasla({ kod: olusan.deneme.kod, ad: "Efe", soyad: "Demir", telefon: "05550001122" });
  if (!("oturumId" in bas2) || !bas2.oturumId) throw new Error("ikinci oturum yok");
  const hata = await sinavTeslim(bas2.oturumId, {});
  assert.equal(hata.sonuc?.bos, 6);
  assert.equal(hata.sms.length, 1);
  assert.equal(hata.sms[0].durum, "hata");
  const yine = await sinavTeslim(bas2.oturumId, {});
  assert.equal(yine.ayni, true);
  assert.equal(yine.sms.length, 1);
  const yeniden = await smsYeniden(bas2.oturumId);
  assert.equal(yeniden.sms.length, 2);
  assert.equal((await depoOku()).oturumlar.filter((o) => o.id === bas2.oturumId)[0].sonuc?.bos, 6);
});

test("örnek PDF metninden aynı anahtar çıkar", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { pathToFileURL } = await import("url");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  const doc = await pdfjs.getDocument({ data: karisikDenemePdf(), useSystemFonts: true }).promise;
  const sayfalar: SayfaGirdi[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const taban = page.getViewport({ scale: 1 });
    const icerik = await page.getTextContent();
    const parcalar = [];
    for (const item of icerik.items) {
      if (!("str" in item) || !String(item.str).trim()) continue;
      const t = item.transform as number[];
      const h = Number(item.height) || 12;
      parcalar.push({
        metin: String(item.str),
        x: t[4],
        y: taban.height - t[5] - h,
        w: Number(item.width) || 8,
        h,
      });
    }
    sayfalar.push({
      sayfa: n,
      genislik: taban.width,
      yukseklik: taban.height,
      ocr: false,
      satirlar: satirlaraBol(parcalar),
    });
  }
  const sorular = ayikla(sayfalar).filter((s) => !s.inceleme);
  assert.equal(sorular.length, 6);
  assert.deepEqual(
    sorular.map((s) => `${s.ders}:${s.numara}${s.dogru}`),
    [
      "Türkçe:1B",
      "Türkçe:2A",
      "Türkçe:3C",
      "T.C. İnkılap Tarihi ve Atatürkçülük:1C",
      "Matematik:1B",
      "Fen Bilimleri:1B",
    ]
  );
  assert.ok(sorular[0].ortakMetin?.includes("yürüyerek"));
});
