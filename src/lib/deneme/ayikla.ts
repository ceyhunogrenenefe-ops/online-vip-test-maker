/**
 * PDF metin satırlarını sorulara ayırır.
 *
 * Grafik ve formül metne dökülmez; her sorunun kutusu sayfa görselinden
 * kırpılır. Ortak parçaya bağlı sorular aynı grupta kalır. Numara,
 * seçenek veya ders güvenle çıkmazsa kesit inceleme diye işaretlenir —
 * yönetici o görseli düzeltmeden soru yayımlanamaz.
 */

import { matematikSupheliMi } from "../math-detect.ts";
import type { AyiklananSoru, Kutu, MetinSatir, SayfaGirdi, Sik } from "./model";
import { norm } from "./turkce.ts";

type Baslik = string | "anahtar" | "atla";

const BILINEN: { ad: string; test: (n: string) => boolean }[] = [
  { ad: "Türkçe", test: (n) => n === "turkce" },
  {
    ad: "T.C. İnkılap Tarihi ve Atatürkçülük",
    test: (n) => n.includes("inkilap") || n.includes("ataturkculuk"),
  },
  {
    ad: "Din Kültürü ve Ahlak Bilgisi",
    test: (n) => n.includes("din kulturu") || (n.includes("din") && n.includes("ahlak")),
  },
  { ad: "İngilizce", test: (n) => n === "ingilizce" || n === "english" },
  { ad: "Matematik", test: (n) => n === "matematik" },
  { ad: "Fen Bilimleri", test: (n) => n === "fen bilimleri" || n === "fen" },
];

type KonumSatir = MetinSatir & { sayfa: number; ocr: boolean };

type Taslak = {
  sayfa: number;
  numara: number | null;
  ders: string;
  ocr: boolean;
  satirlar: KonumSatir[];
  grupId: string | null;
  ortakMetin: string | null;
  ortakSatirlar: KonumSatir[];
};

export function baslikSatiri(metin: string): Baslik | null {
  const ham = metin.trim();
  const n = norm(ham);
  if (!n || n.length > 80) return null;
  if (/^\d/.test(ham)) return null;
  if (/^[A-D\s.,]+$/i.test(ham)) return null;
  if (n === "cevap anahtari" || n.startsWith("cevap anahtari")) return "anahtar";
  if (n === "sozel" || n === "sayisal" || n === "deneme" || n === "sinav") return "atla";
  for (const b of BILINEN) {
    if (b.test(n)) return b.ad;
  }
  const harfVar = /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(ham);
  if (
    harfVar &&
    !/\d/.test(ham) &&
    ham.length >= 4 &&
    ham.length <= 50 &&
    ham === ham.toLocaleUpperCase("tr")
  ) {
    return ham;
  }
  return null;
}

export function secenekParcala(satir: string): { harf: Sik; metin: string }[] | null {
  const t = satir.trim();
  const re = /([A-D])\s*[).]\s*/gi;
  const hits = [...t.matchAll(re)];
  if (!hits.length || hits[0].index !== 0) return null;
  const out: { harf: Sik; metin: string }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const bas = (hits[i].index ?? 0) + hits[i][0].length;
    const bit = i + 1 < hits.length ? (hits[i + 1].index ?? t.length) : t.length;
    out.push({
      harf: hits[i][1].toUpperCase() as Sik,
      metin: t.slice(bas, bit).trim(),
    });
  }
  return out;
}

function anahtarCiftleri(satir: string): { no: number; sik: Sik }[] {
  const out: { no: number; sik: Sik }[] = [];
  const re = /(\d{1,3})\s*[-.):]\s*([A-D])\b/gi;
  for (const m of satir.matchAll(re)) {
    out.push({ no: Number(m[1]), sik: m[2].toUpperCase() as Sik });
  }
  if (out.length) return out;
  const re2 = /(?:^|\s)(\d{1,3})\s+([A-D])(?=\s|$)/gi;
  for (const m of satir.matchAll(re2)) {
    out.push({ no: Number(m[1]), sik: m[2].toUpperCase() as Sik });
  }
  return out;
}

function soruBaslangici(metin: string): { no: number; devam: string } | null {
  const grup = /^(\d{1,3})\s*[-–]\s*(\d{1,3})\s*[.)]/i.test(metin.trim());
  if (grup) return null;
  const m = metin.trim().match(/^(\d{1,3})\s*[.)]\s*(.*)$/);
  if (!m) return null;
  return { no: Number(m[1]), devam: m[2].trim() };
}

function grupBaslangici(metin: string): { bas: number; bit: number } | null {
  const m = metin.trim().match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})\s*[.)]\s*(.*)$/i);
  if (!m) return null;
  const kalan = norm(m[3] || metin);
  if (!kalan.includes("soru") && !kalan.includes("parca") && !kalan.includes("metin")) return null;
  const bas = Number(m[1]);
  const bit = Number(m[2]);
  if (bit < bas) return null;
  return { bas, bit };
}

function kutuYap(satirlar: KonumSatir[]): Kutu {
  const x = Math.min(...satirlar.map((s) => s.x));
  const y = Math.min(...satirlar.map((s) => s.y));
  const sag = Math.max(...satirlar.map((s) => s.x + s.w));
  const alt = Math.max(...satirlar.map((s) => s.y + s.h));
  return {
    x: Math.max(0, x - 8),
    y: Math.max(0, y - 6),
    w: sag - x + 16,
    h: alt - y + 12,
  };
}

function bitir(taslak: Taslak, sira: number): AyiklananSoru {
  const secenekler: Partial<Record<Sik, string>> = {};
  const govde: string[] = [];
  for (const s of taslak.satirlar) {
    const sec = secenekParcala(s.metin);
    if (sec) {
      for (const o of sec) secenekler[o.harf] = o.metin;
    } else if (s.metin.trim()) govde.push(s.metin.trim());
  }
  const metin = govde.join(" ").replace(/\s+/g, " ").trim();
  const matematikVar = taslak.satirlar.some((s) => matematikSupheliMi(s.metin));
  const guvenler = taslak.satirlar
    .map((s) => s.guven)
    .filter((g): g is number => typeof g === "number");
  const ocrGuven = guvenler.length
    ? guvenler.reduce((a, b) => a + b, 0) / guvenler.length
    : 100;
  const sikSayisi = Object.keys(secenekler).length;
  let guven = 0.45;
  if (taslak.numara) guven += 0.2;
  if (sikSayisi >= 4) guven += 0.25;
  else if (sikSayisi >= 2) guven += 0.05;
  if (metin.length > 12) guven += 0.1;
  if (taslak.ocr && ocrGuven < 70) guven -= 0.3;
  if (taslak.ocr && matematikVar) guven -= 0.25;

  const neden: string[] = [];
  if (!taslak.numara) neden.push("Soru numarası bulunamadı");
  if (!taslak.ders || taslak.ders === "Belirsiz") neden.push("Ders belirlenemedi");
  if (taslak.ocr && matematikVar) {
    neden.push("Matematik ifadesi, grafik veya şekil OCR ile güvenilir değil; görseli kontrol edin");
  }
  if (taslak.ocr && ocrGuven < 70) neden.push("OCR güveni düşük");

  const satirlar = taslak.satirlar.length ? taslak.satirlar : taslak.ortakSatirlar;
  return {
    yerelId: `p${taslak.sayfa}-n${taslak.numara ?? "x"}-${sira}`,
    ders: taslak.ders || "Belirsiz",
    sayfa: taslak.sayfa,
    numara: taslak.numara,
    metin,
    secenekler,
    dogru: null,
    grupId: taslak.grupId,
    ortakMetin: taslak.ortakMetin,
    guven: Math.max(0, Math.min(1, guven)),
    inceleme: neden.length > 0,
    incelemeNeden: neden.length ? neden.join(". ") : null,
    matematikVar,
    kutu: kutuYap(satirlar.length ? satirlar : [{ metin: "", x: 40, y: 40, w: 400, h: 40, sayfa: taslak.sayfa, ocr: taslak.ocr }]),
    ortakKutu: taslak.ortakSatirlar.length ? kutuYap(taslak.ortakSatirlar) : null,
  };
}

function anahtariUygula(
  sorular: AyiklananSoru[],
  harita: Map<string, Map<number, Sik>>,
  konuEtiketli: boolean,
  sirali: { no: number; sik: Sik }[]
) {
  if (konuEtiketli) {
    for (const soru of sorular) {
      const ders = harita.get(norm(soru.ders));
      if (soru.numara && ders?.has(soru.numara)) soru.dogru = ders.get(soru.numara) ?? null;
    }
    return;
  }
  if (sirali.length === sorular.length && sorular.every((s) => s.numara)) {
    sorular.forEach((s, i) => {
      s.dogru = sirali[i].sik;
    });
    return;
  }
  const kullanilan = new Set<AyiklananSoru>();
  for (const c of sirali) {
    const soru = sorular.find((s) => !kullanilan.has(s) && s.numara === c.no);
    if (!soru) continue;
    soru.dogru = c.sik;
    kullanilan.add(soru);
  }
}

function kutulariGenislet(sorular: AyiklananSoru[], sayfalar: SayfaGirdi[], basliklar: { sayfa: number; y: number }[]) {
  for (const s of sorular) {
    const sayfa = sayfalar.find((p) => p.sayfa === s.sayfa);
    const gen = sayfa?.genislik ?? 595;
    const iki = sorular.some((q) => q.sayfa === s.sayfa && q.kutu.x > gen * 0.42);
    if (!iki) continue;
    if (s.kutu.x > gen * 0.42) {
      s.kutu.x = gen / 2 - 6;
      s.kutu.w = gen / 2 - 22;
    } else {
      s.kutu.x = 24;
      s.kutu.w = gen / 2 - 30;
    }
  }
  for (let i = 0; i < sorular.length; i++) {
    const s = sorular[i];
    const sayfa = sayfalar.find((p) => p.sayfa === s.sayfa);
    const yuk = sayfa?.yukseklik ?? 842;
    const sonraki = sorular
      .slice(i + 1)
      .find((n) => n.sayfa === s.sayfa && Math.abs(n.kutu.x - s.kutu.x) < 80 && n.kutu.y > s.kutu.y);
    const baslik = basliklar
      .filter((b) => b.sayfa === s.sayfa && b.y > s.kutu.y + 8)
      .sort((a, b) => a.y - b.y)[0];
    let alt = sonraki ? sonraki.kutu.y - 4 : yuk - 28;
    if (baslik) alt = Math.min(alt, baslik.y - 4);
    if (alt > s.kutu.y + 24) s.kutu.h = alt - s.kutu.y;
    if (s.ortakKutu && s.ortakKutu.y + s.ortakKutu.h < s.kutu.y) {
      s.ortakKutu = { ...s.ortakKutu, h: s.kutu.y - 4 - s.ortakKutu.y };
    }
  }
}

export function ayikla(sayfalar: SayfaGirdi[]): AyiklananSoru[] {
  const satirlar: KonumSatir[] = [];
  for (const sayfa of sayfalar) {
    for (const s of sayfa.satirlar) {
      const metin = s.metin.replace(/\s+/g, " ").trim();
      if (!metin) continue;
      if (/^[-–]?\s*\d{1,3}\s*[-–]$/.test(metin)) continue;
      satirlar.push({ ...s, metin, sayfa: sayfa.sayfa, ocr: sayfa.ocr });
    }
  }

  const sorular: AyiklananSoru[] = [];
  const harita = new Map<string, Map<number, Sik>>();
  const sirali: { no: number; sik: Sik }[] = [];
  let konuEtiketli = false;
  let ders = "Belirsiz";
  let anahtar = false;
  let anahtarDers: string | null = null;
  let taslak: Taslak | null = null;
  let grup: { id: string; bas: number; bit: number; satirlar: KonumSatir[] } | null = null;
  const tuketilen = new Set<KonumSatir>();
  const basliklar: { sayfa: number; y: number }[] = [];

  const flush = () => {
    if (!taslak || !taslak.satirlar.length) {
      taslak = null;
      return;
    }
    sorular.push(bitir(taslak, sorular.length + 1));
    taslak = null;
  };

  for (const satir of satirlar) {
    if (taslak && satir.sayfa !== taslak.sayfa) flush();

    const baslik = baslikSatiri(satir.metin);
    if (!anahtar && baslik === "anahtar") {
      flush();
      anahtar = true;
      tuketilen.add(satir);
      continue;
    }

    if (anahtar) {
      tuketilen.add(satir);
      const kolon = satir.metin.split(":");
      let hedef = satir.metin;
      if (kolon.length > 1) {
        const sol = baslikSatiri(kolon[0]);
        if (typeof sol === "string") {
          anahtarDers = sol;
          konuEtiketli = true;
          hedef = kolon.slice(1).join(":");
        }
      } else if (typeof baslik === "string") {
        anahtarDers = baslik;
        konuEtiketli = true;
        continue;
      }
      const cift = anahtarCiftleri(hedef);
      const kovaAd = anahtarDers || ders;
      if (!harita.has(norm(kovaAd))) harita.set(norm(kovaAd), new Map());
      const kova = harita.get(norm(kovaAd))!;
      for (const c of cift) {
        kova.set(c.no, c.sik);
        sirali.push(c);
      }
      continue;
    }

    if (baslik === "atla") {
      tuketilen.add(satir);
      continue;
    }
    if (typeof baslik === "string") {
      flush();
      ders = baslik;
      grup = null;
      basliklar.push({ sayfa: satir.sayfa, y: satir.y });
      tuketilen.add(satir);
      continue;
    }

    if (/^\d{1,3}$/.test(satir.metin) && satir.x < 110) {
      flush();
      taslak = {
        sayfa: satir.sayfa,
        numara: Number(satir.metin),
        ders,
        ocr: satir.ocr,
        satirlar: [],
        grupId: null,
        ortakMetin: null,
        ortakSatirlar: [],
      };
      tuketilen.add(satir);
      continue;
    }

    const g = grupBaslangici(satir.metin);
    if (g) {
      flush();
      grup = { id: `g-${satir.sayfa}-${g.bas}-${g.bit}`, bas: g.bas, bit: g.bit, satirlar: [] };
      tuketilen.add(satir);
      continue;
    }

    const sb = soruBaslangici(satir.metin);
    if (sb) {
      flush();
      const grupIcinde: boolean = grup !== null && sb.no >= grup.bas && sb.no <= grup.bit;
      const ortakSatirlar: KonumSatir[] = grupIcinde && grup ? [...grup.satirlar] : [];
      taslak = {
        sayfa: satir.sayfa,
        numara: sb.no,
        ders,
        ocr: satir.ocr,
        satirlar: [],
        grupId: grupIcinde ? grup!.id : null,
        ortakMetin: ortakSatirlar.length
          ? ortakSatirlar.map((x) => x.metin).join(" ").replace(/\s+/g, " ").trim()
          : null,
        ortakSatirlar,
      };
      if (sb.devam) {
        taslak.satirlar.push({ ...satir, metin: sb.devam });
      }
      tuketilen.add(satir);
      if (grup && sb.no >= grup.bit) grup = null;
      continue;
    }

    if (taslak) {
      taslak.satirlar.push(satir);
      tuketilen.add(satir);
      continue;
    }
    if (grup) {
      grup.satirlar.push(satir);
      tuketilen.add(satir);
    }
  }
  flush();

  const sayfaSoru = new Set(sorular.map((s) => s.sayfa));
  const artik = new Map<number, KonumSatir[]>();
  for (const satir of satirlar) {
    if (tuketilen.has(satir)) continue;
    const liste = artik.get(satir.sayfa) ?? [];
    liste.push(satir);
    artik.set(satir.sayfa, liste);
  }
  for (const [sayfa, liste] of artik) {
    const metin = liste.map((s) => s.metin).join(" ").replace(/\s+/g, " ").trim();
    if (metin.length < 60) continue;
    if (sayfaSoru.has(sayfa) && metin.length < 120) continue;
    const ocr = liste.some((s) => s.ocr);
    sorular.push(
      bitir(
        {
          sayfa,
          numara: null,
          ders,
          ocr,
          satirlar: liste,
          grupId: null,
          ortakMetin: null,
          ortakSatirlar: [],
        },
        sorular.length + 1
      )
    );
    const son = sorular[sorular.length - 1];
    son.inceleme = true;
    son.incelemeNeden = "Bu kesitte sorular güvenle ayrılamadı. Görseli kontrol edip düzeltin.";
    son.guven = Math.min(son.guven, 0.35);
  }

  anahtariUygula(sorular, harita, konuEtiketli, sirali);
  kutulariGenislet(sorular, sayfalar, basliklar);
  return sorular;
}

export type AnahtarKayit = { ders: string | null; no: number; sik: Sik };

/** Öğretmenin yüklediği cevap metnini ders ve soru numarasına böler. */
export function anahtarOku(metin: string): AnahtarKayit[] {
  const kayit: AnahtarKayit[] = [];
  let ders: string | null = null;
  let sira = 0;
  for (const ham of metin.split(/\r?\n/)) {
    const t = ham.trim();
    if (!t) continue;
    const kolon = t.split(":");
    const solBaslik = kolon.length > 1 ? baslikSatiri(kolon[0].trim()) : null;
    const baslik = typeof solBaslik === "string" ? solBaslik : baslikSatiri(t.replace(/:$/, ""));
    if (baslik === "anahtar" || baslik === "atla") continue;
    if (typeof baslik === "string") {
      ders = baslik;
      sira = 0;
      if (kolon.length < 2 || typeof solBaslik !== "string") continue;
    }
    const hedef = typeof solBaslik === "string" ? kolon.slice(1).join(":") : t;
    const cift = anahtarCiftleri(hedef);
    if (!cift.length) {
      const yapisik = [...hedef.matchAll(/(\d{1,3})\s*([A-D])(?!\d)/gi)];
      for (const m of yapisik) cift.push({ no: Number(m[1]), sik: m[2].toUpperCase() as Sik });
    }
    if (cift.length) {
      for (const c of cift) kayit.push({ ders, no: c.no, sik: c.sik });
      continue;
    }
    if (!/^[A-Da-d\s.,]+$/.test(hedef)) continue;
    const harfler = hedef.replace(/[^A-Da-d]/g, "");
    for (const ch of harfler.toUpperCase()) {
      sira += 1;
      kayit.push({ ders, no: sira, sik: ch as Sik });
    }
  }
  return kayit;
}

/** Kesilen sorulara cevap anahtarını ders ve numara ile yazar. */
export function cevaplariEsle<T extends { id: string; ders: string; numara: number | null }>(
  sorular: T[],
  kayitlar: AnahtarKayit[]
): { id: string; dogru: Sik }[] {
  const sonuc: { id: string; dogru: Sik }[] = [];
  const kullanilan = new Set<string>();
  const etiketli = kayitlar.some((k) => k.ders);
  if (etiketli) {
    for (const k of kayitlar) {
      if (!k.ders) continue;
      const soru = sorular.find(
        (s) => !kullanilan.has(s.id) && s.numara === k.no && norm(s.ders) === norm(k.ders!)
      );
      if (!soru) continue;
      kullanilan.add(soru.id);
      sonuc.push({ id: soru.id, dogru: k.sik });
    }
    return sonuc;
  }
  const numarali = sorular.filter((s) => s.numara);
  if (kayitlar.length === numarali.length && kayitlar.length > 0) {
    return numarali.map((s, i) => ({ id: s.id, dogru: kayitlar[i].sik }));
  }
  for (const k of kayitlar) {
    const soru = sorular.find((s) => !kullanilan.has(s.id) && s.numara === k.no);
    if (!soru) continue;
    kullanilan.add(soru.id);
    sonuc.push({ id: soru.id, dogru: k.sik });
  }
  return sonuc;
}
