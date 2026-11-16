/**
 * Cevap anahtarı sayfasını konumlu kelimelerden okur.
 *
 * Desteklenen biçimler: "1. A", "1-A", "1A", "1 A"; numara satırının altında
 * harf satırı olan tablo; yan yana ders sütunları. Her cevap, üstünde ve
 * yatayda en yakın duran ders başlığına bağlanır. Başlık yoksa numaranın
 * 1'e dönmesi yeni teste geçiş sayılır.
 */

import { testAdet, type FormatTest } from "./format.ts";
import { satirla, type Kelime } from "./kesim.ts";
import type { Kutu, Sik } from "./model.ts";
import { norm } from "./turkce.ts";

type Cift = { no: number; harf: Sik; x: number; y: number };
type Baslik = { test: number; x0: number; x1: number; y: number };

const HARF = /^([A-E])[.)]?$/;

function testBul(metin: string, testler: FormatTest[]): number | null {
  const n = norm(metin).replace(/\b(testi|test|cevaplari|cevap anahtari)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!n || n.split(" ").length > 7 || /\d/.test(n)) return null;
  let en: { i: number; u: number } | null = null;
  testler.forEach((t, i) => {
    for (const ad of [norm(t.ad), ...t.adlar]) {
      const a = ad.replace(/[-–]/g, " ").replace(/\s+/g, " ");
      if ((n === a || n.startsWith(`${a} `) || n.endsWith(` ${a}`)) && (!en || a.length > en.u)) en = { i, u: a.length };
    }
  });
  return en ? (en as { i: number }).i : null;
}

/** "Cevap anahtarı" yazan ve gerçekten çok sayıda şık harfi içeren sayfa ("karekodu okutunuz" notu sayılmaz). */
export function anahtarSayfasiMi(kelimeler: Kelime[]): boolean {
  if (!/cevap anahtari/.test(norm(kelimeler.map((k) => k.metin).join(" ")))) return false;
  const harf = kelimeler.filter((k) => /^(\d{1,3}[.)\-:]?)?[A-E][.)]?$/.test(k.metin)).length;
  return harf >= 8 && harf >= kelimeler.length * 0.15;
}

/**
 * `doluluk` bir harf kutusunun ne kadar boyalı olduğunu (0–1) söyler.
 * "1. Ⓐ B C D" gibi tüm şıkları yazan anahtarlarda işaretli şık buradan seçilir.
 */
export function anahtarCoz(
  kelimeler: Kelime[],
  testler: FormatTest[],
  tekTest: number | null = null,
  doluluk?: (k: Kutu) => number
): Map<string, Sik> {
  const satirlar = satirla(kelimeler);
  const ciftler: Cift[] = [];
  const basliklar: Baslik[] = [];

  satirlar.forEach((satir, si) => {
    const k = satir.kelimeler;
    const ortH = k.reduce((t, w) => t + w.h, 0) / Math.max(1, k.length);
    // Başlıklar: büyük boşlukla ayrılmış parçalar.
    let parca: Kelime[] = [];
    const parcaBitir = () => {
      if (!parca.length) return;
      const test = testBul(parca.map((w) => w.metin).join(" "), testler);
      if (test != null) {
        const x0 = parca[0].x;
        const son = parca[parca.length - 1];
        basliklar.push({ test, x0, x1: son.x + son.w, y: satir.y });
      }
      parca = [];
    };
    k.forEach((w, i) => {
      if (i > 0 && w.x - (k[i - 1].x + k[i - 1].w) > Math.max(10, ortH * 1.6)) parcaBitir();
      parca.push(w);
    });
    parcaBitir();

    // Tablo: tamamı numara olan satırın altındaki harf satırı.
    const hepsiNo = k.length >= 3 && k.every((w) => /^\d{1,3}[.)]?$/.test(w.metin));
    if (hepsiNo) {
      const alt = satirlar
        .slice(si + 1)
        .find((s) => s.y > satir.y && s.y - satir.y < satir.h * 3.5 && s.kelimeler.every((w) => HARF.test(w.metin)));
      if (alt) {
        for (const h of alt.kelimeler) {
          const orta = h.x + h.w / 2;
          const yakin = [...k].sort((a, b) => Math.abs(a.x + a.w / 2 - orta) - Math.abs(b.x + b.w / 2 - orta))[0];
          if (Math.abs(yakin.x + yakin.w / 2 - orta) > Math.max(20, yakin.w * 2)) continue;
          ciftler.push({ no: parseInt(yakin.metin, 10), harf: h.metin[0] as Sik, x: yakin.x, y: satir.y });
        }
        return;
      }
    }

    for (let i = 0; i < k.length; i++) {
      const w = k[i].metin;
      // Numara + sıralı şık harfleri (A B C D [E]): işaretli olanı boyadan bul.
      const noSira = w.match(/^(\d{1,3})[.)\-:]?$/);
      if (noSira) {
        let j = i + 1;
        const harfler: Kelime[] = [];
        while (j < k.length && k[j].metin.replace(/[.)]/g, "") === "ABCDE"[harfler.length]) harfler.push(k[j++]);
        if (harfler.length >= 4) {
          if (doluluk) {
            const puan = harfler.map((h) => doluluk({ x: h.x - h.h * 0.45, y: h.y - h.h * 0.3, w: h.w + h.h * 0.9, h: h.h * 1.6 }));
            const sirali = [...puan].sort((a, b) => b - a);
            if (sirali[0] > 0.15 && sirali[0] > sirali[1] * 1.6) {
              ciftler.push({ no: Number(noSira[1]), harf: "ABCDE"[puan.indexOf(sirali[0])] as Sik, x: k[i].x, y: satir.y });
            }
          }
          i = j - 1;
          continue;
        }
      }
      const bitisik = w.match(/^(\d{1,3})[.)\-:]?([A-E])[.)]?$/);
      if (bitisik) {
        ciftler.push({ no: Number(bitisik[1]), harf: bitisik[2] as Sik, x: k[i].x, y: satir.y });
        continue;
      }
      const no = w.match(/^(\d{1,3})[.)\-:]?$/);
      const sonraki = k[i + 1];
      if (no && sonraki && HARF.test(sonraki.metin) && sonraki.x - (k[i].x + k[i].w) < Math.max(40, ortH * 4)) {
        ciftler.push({ no: Number(no[1]), harf: sonraki.metin[0] as Sik, x: k[i].x, y: satir.y });
        i++;
      }
    }
  });

  const sonuc = new Map<string, Sik>();
  const koy = (test: number, no: number, harf: Sik) => {
    const anahtar = `${test}:${no}`;
    if (!sonuc.has(anahtar)) sonuc.set(anahtar, harf);
  };

  if (tekTest != null) {
    for (const c of ciftler) koy(tekTest, c.no, c.harf);
    return sonuc;
  }

  const basliksiz: Cift[] = [];
  for (const c of ciftler) {
    const ustte = basliklar.filter((b) => b.y <= c.y + 2);
    if (!ustte.length) {
      basliksiz.push(c);
      continue;
    }
    const uzaklik = (b: Baslik) => {
      const d = c.x < b.x0 ? b.x0 - c.x : c.x > b.x1 ? c.x - b.x1 : 0;
      return d < 30 ? 0 : d;
    };
    ustte.sort((a, b) => uzaklik(a) - uzaklik(b) || b.y - a.y);
    koy(ustte[0].test, c.no, c.harf);
  }

  if (basliksiz.length) {
    // Sütun sütun, yukarıdan aşağı oku; numara geri dönerse yeni test.
    const xler = [...basliksiz].sort((a, b) => a.x - b.x);
    const kume = new Map<Cift, number>();
    let k = 0;
    xler.forEach((c, i) => {
      if (i > 0 && c.x - xler[i - 1].x > 40) k++;
      kume.set(c, k);
    });
    const sirali = [...basliksiz].sort((a, b) => kume.get(a)! - kume.get(b)! || a.y - b.y);
    let test = 0;
    let onceki = 0;
    const toplam = testler.map(testAdet);
    const surekli = sirali.every((c, i) => i === 0 || c.no > sirali[i - 1].no) && (sirali.at(-1)?.no ?? 0) > toplam[0];
    for (const c of sirali) {
      if (surekli) {
        // 1–90 gibi kesintisiz numaralama: testlere sırayla dağıt.
        let kalan = c.no;
        let t = 0;
        while (t < toplam.length - 1 && kalan > toplam[t]) kalan -= toplam[t++];
        koy(t, kalan, c.harf);
        continue;
      }
      if (c.no <= onceki) test = Math.min(test + 1, testler.length - 1);
      onceki = c.no;
      koy(test, c.no, c.harf);
    }
  }
  return sonuc;
}
