/**
 * Sayfadaki kelime konumlarından soruların kutularını çıkarır.
 *
 * Dijital PDF'te kelimeler metin katmanından, taranmış sayfada OCR'dan
 * gelir; algoritma ikisinde aynıdır. Sütun ayırıcı (bolmeX) piksellerden
 * bulunur. Soru, sütunun sol kenarındaki "12." biçimli satırla başlar ve
 * aynı sütundaki bir sonraki soru/başlık/ortak metin satırına kadar sürer.
 */

import { baslikTesti, type FormatTest } from "./format.ts";
import type { Kutu } from "./model.ts";
import { norm } from "./turkce.ts";

export type Kelime = { metin: string; x: number; y: number; w: number; h: number };

export type SayfaVeri = {
  sayfa: number;
  genislik: number;
  yukseklik: number;
  kelimeler: Kelime[];
  /** İki sütunlu sayfada sütun arası boşluğun ortası; tek sütunda null. */
  bolmeX: number | null;
};

export type BulunanSoru = {
  sayfa: number;
  testIndex: number;
  numara: number | null;
  kutu: Kutu;
  /** Görseldeki eski soru numarası; kesimde beyaza boyanır. */
  noKutu: Kutu | null;
  grupId: string | null;
};

export type BulunanGrup = {
  id: string;
  testIndex: number;
  ilk: number;
  son: number;
  parcalar: { sayfa: number; kutu: Kutu }[];
};

export type KesimSonuc = { sorular: BulunanSoru[]; gruplar: BulunanGrup[] };

type Satir = {
  metin: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kelimeler: Kelime[];
  sutun: number;
  bant: number;
};

const SORU_NO = /^(\d{1,3}|#)\s*[.,)](?!\d)/;
const GRUP = /(?:^|\s)(\d{1,3})\s+(?:ve\s+|ile\s+)?(\d{1,3})\s+(?:numarali\s+)?sorulari/;

/** Aynı satırdaki kelimeleri soldan sağa birleştirir. */
export function satirla(kelimeler: Kelime[]): Omit<Satir, "sutun" | "bant">[] {
  const sirali = [...kelimeler].filter((k) => k.metin.trim()).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const satirlar: Omit<Satir, "sutun" | "bant">[] = [];
  for (const k of sirali) {
    const orta = k.y + k.h / 2;
    const son = satirlar.find((s) => Math.abs(s.y + s.h / 2 - orta) <= Math.max(3, Math.min(s.h, k.h) * 0.5));
    if (son) {
      son.kelimeler.push(k);
      const sag = Math.max(son.x + son.w, k.x + k.w);
      const alt = Math.max(son.y + son.h, k.y + k.h);
      son.x = Math.min(son.x, k.x);
      son.y = Math.min(son.y, k.y);
      son.w = sag - son.x;
      son.h = alt - son.y;
    } else {
      satirlar.push({ metin: "", x: k.x, y: k.y, w: k.w, h: k.h, kelimeler: [k] });
    }
  }
  for (const s of satirlar) {
    s.kelimeler.sort((a, b) => a.x - b.x);
    s.metin = s.kelimeler.map((k) => k.metin).join(" ").replace(/\s+/g, " ").trim();
  }
  return satirlar.sort((a, b) => a.y - b.y);
}

/** "12." kelimesinin kutusu. "12.Aşağıdaki" bitişikse genişlik orantıyla kısaltılır. */
export function numaraKutusu(satir: { kelimeler: Kelime[] }): Kutu | null {
  const [ilk, ikinci] = satir.kelimeler;
  if (!ilk) return null;
  const m = ilk.metin.match(/^(\d{1,3}|#)\s*[.,)]?/);
  if (!m) return null;
  let w = ilk.metin.length > m[0].length ? (ilk.w * m[0].length) / ilk.metin.length : ilk.w;
  if (/^\d+$/.test(ilk.metin) && ikinci && /^[.,)]$/.test(ikinci.metin)) w = ikinci.x + ikinci.w - ilk.x;
  return { x: ilk.x - 1, y: ilk.y - 1, w: w + 2, h: ilk.h + 2 };
}

function talimatMi(metin: string): boolean {
  const n = norm(metin);
  return /bu testte|soru vardir|cevaplarinizi|cevap kagidi|optik form/.test(n);
}

/**
 * Sayfa satırlarını sütunlara ayırıp okuma sırasına koyar.
 * Sütun boşluğunu kesintisiz geçen satır tam genişliktir (sutun -1);
 * tam genişlik satırlar bantları ayırır. Okuma: bant → sol → sağ.
 */
function sayfaSatirlari(s: SayfaVeri): Satir[] {
  const b = s.bolmeX;
  if (b == null) return satirla(s.kelimeler).map((l) => ({ ...l, sutun: 0, bant: 0 }));
  const parcalar: Omit<Satir, "bant">[] = [];
  const yap = (k: Kelime[], sutun: number) => {
    const l = satirla(k)[0];
    if (l) parcalar.push({ ...l, sutun });
  };
  for (const l of satirla(s.kelimeler)) {
    const k = l.kelimeler;
    // Bölme çizgisine yakın en geniş kelime aralığından ayır; piksel tahmini birkaç punto kaysa da doğru böler.
    let kes = -1;
    let enGenis = 0;
    for (let i = 0; i < k.length - 1; i++) {
      const bosBas = k[i].x + k[i].w;
      const bosSon = k[i + 1].x;
      if (bosSon < b - 25 || bosBas > b + 25) continue;
      // Bölme çizgisi bir boşluğun içindeyse o boşluk kazanır.
      if (bosBas <= b && bosSon >= b) {
        kes = i;
        enGenis = bosSon - bosBas;
        break;
      }
      if (bosSon - bosBas > enGenis) {
        enGenis = bosSon - bosBas;
        kes = i;
      }
    }
    const tamamSolda = k[k.length - 1].x + k[k.length - 1].w <= b + 25 && k.every((w) => w.x + w.w / 2 < b);
    const tamamSagda = k[0].x >= b - 25 && k.every((w) => w.x + w.w / 2 >= b);
    if (tamamSolda) yap(k, 0);
    else if (tamamSagda) yap(k, 1);
    else if (kes >= 0 && enGenis >= 8) {
      yap(k.slice(0, kes + 1), 0);
      yap(k.slice(kes + 1), 1);
    } else yap(k, -1);
  }
  // Satırların çoğu bölmeyi geçiyorsa sayfa aslında tek sütundur (yanında resim olan soru vb.).
  if (parcalar.filter((l) => l.sutun < 0).length > parcalar.length * 0.5) {
    return satirla(s.kelimeler).map((l) => ({ ...l, sutun: 0, bant: 0 }));
  }
  const tam = parcalar.filter((l) => l.sutun < 0).map((l) => l.y).sort((a, c) => a - c);
  const sonuc = parcalar.map((l) => ({ ...l, bant: tam.filter((y) => y <= l.y + 0.5).length }));
  sonuc.sort((a, c) => a.bant - c.bant || a.sutun - c.sutun || a.y - c.y);
  return sonuc;
}

export function sorulariBul(
  sayfalar: SayfaVeri[],
  ayar: { testler: FormatTest[]; tekTest: number | null }
): KesimSonuc {
  const sorular: BulunanSoru[] = [];
  const gruplar: BulunanGrup[] = [];
  let testIndex = ayar.tekTest ?? 0;
  let son: number | null = null;
  let baslikGeldi = false;
  let bekleyen: BulunanGrup | null = null;
  let grupSayac = 0;

  for (const s of sayfalar) {
    const satirlar = sayfaSatirlari(s);
    const altlik = satirlar.filter(
      (l) => (l.y > s.yukseklik * 0.93 && l.metin.length < 60) || /sayfaya gec|testi bitti|kontrol ediniz/.test(norm(l.metin))
    );
    const icerikAlt = altlik.length ? Math.min(...altlik.map((l) => l.y)) - 2 : s.yukseklik * 0.97;

    const sutunSinir = (sutun: number) => {
      const liste = satirlar.filter((l) => (sutun < 0 || l.sutun === sutun) && l.metin.length > 2 && l.y < icerikAlt);
      // Sol kenar numaralı satırlardan ölçülür; kenardaki dikey etiketler ("SINIF") yanıltmasın.
      const numarali = liste.filter((l) => SORU_NO.test(l.metin) && !talimatMi(l.metin));
      const sol = numarali.length
        ? Math.min(...numarali.map((l) => l.x))
        : liste.length
          ? Math.min(...liste.map((l) => l.x))
          : 0;
      const sagUc = liste.length ? Math.max(...liste.map((l) => l.x + l.w)) : s.genislik;
      if (s.bolmeX == null || sutun < 0) return { sol, sag: sagUc };
      return sutun === 0 ? { sol, sag: Math.max(sagUc, s.bolmeX - 3) } : { sol: Math.max(sol, s.bolmeX - 4), sag: sagUc };
    };
    const tum = sutunSinir(-1);
    const sinirlar = new Map<number, { sol: number; sag: number }>([
      [-1, { sol: Math.min(tum.sol, sutunSinir(0).sol), sag: tum.sag }],
      [0, sutunSinir(0)],
      [1, sutunSinir(1)],
    ]);

    type Durak = { sutun: number; y: number };
    const duraklar: Durak[] = [];
    type Acik = { soru: BulunanSoru; sutun: number; ust: number; bas: number };
    const aciklar: Acik[] = [];
    type GrupParca = { grup: BulunanGrup; sutun: number; ust: number };
    const grupParcalari: GrupParca[] = [];
    let sayfadaIlk = true;

    for (const l of satirlar) {
      if (l.y >= icerikAlt) continue;
      const kenar = sinirlar.get(l.sutun)!;
      const solda = l.x <= kenar.sol + Math.max(12, (kenar.sag - kenar.sol) * 0.07);

      const baslik = baslikTesti(l.metin, ayar.testler);
      if (baslik != null) {
        duraklar.push({ sutun: l.sutun, y: l.y });
        if (ayar.tekTest == null && baslik !== testIndex) {
          testIndex = baslik;
          son = null;
        }
        baslikGeldi = true;
        continue;
      }

      const n = norm(l.metin);
      const g = solda ? n.match(GRUP) : null;
      if (g) {
        const ilk = Number(g[1]);
        const sonNo = Number(g[2]);
        if (sonNo > ilk && sonNo - ilk <= 6) {
          duraklar.push({ sutun: l.sutun, y: l.y });
          const grup: BulunanGrup = { id: `g${++grupSayac}`, testIndex, ilk, son: sonNo, parcalar: [] };
          gruplar.push(grup);
          grupParcalari.push({ grup, sutun: l.sutun, ust: l.y + l.h + 1 });
          bekleyen = grup;
          continue;
        }
      }

      const m = l.metin.match(SORU_NO);
      if (!m || !solda || talimatMi(l.metin)) continue;
      // "#." okunamamış kenar numarasıdır; sıradaki numara verilir.
      const bilinmeyen = m[1] === "#";
      const no: number = bilinmeyen ? (son ?? 0) + 1 : Number(m[1]);
      let kabul = false;
      if (son === null || bilinmeyen) kabul = true;
      else if (no > son && no <= son + 4) kabul = true;
      else if (no > son && sayfadaIlk) kabul = true;
      else if (no === 1 && (baslikGeldi || (sayfadaIlk && ayar.tekTest == null))) {
        kabul = true;
        if (!baslikGeldi) testIndex = Math.min(testIndex + 1, ayar.testler.length - 1);
      }
      if (!kabul) continue;
      son = no;
      baslikGeldi = false;
      sayfadaIlk = false;
      duraklar.push({ sutun: l.sutun, y: l.y });

      // Önceki sütunda kalan ortak metin bu sütunun başına taşmış olabilir.
      if (bekleyen && no === bekleyen.ilk && !grupParcalari.some((p) => p.grup === bekleyen && p.sutun === l.sutun)) {
        const bolge = satirlar.filter((x) => x.sutun === l.sutun && x.bant === l.bant && x.y < l.y);
        const bolgeUst = bolge.length ? Math.min(...bolge.map((x) => x.y)) : l.y;
        if (bolgeUst < l.y - 4) grupParcalari.push({ grup: bekleyen, sutun: l.sutun, ust: bolgeUst - 2 });
      }
      const grup = bekleyen && no >= bekleyen.ilk && no <= bekleyen.son ? bekleyen : null;
      if (bekleyen && no >= bekleyen.son) bekleyen = null;

      const pay = l.h * 0.35 + 2;
      const soru: BulunanSoru = {
        sayfa: s.sayfa,
        testIndex,
        numara: no,
        kutu: { x: 0, y: 0, w: 0, h: 0 },
        noKutu: numaraKutusu(l),
        grupId: grup?.id ?? null,
      };
      sorular.push(soru);
      aciklar.push({ soru, sutun: l.sutun, ust: Math.max(0, l.y - pay), bas: l.y });
    }

    const altBul = (sutun: number, bas: number) => {
      const altlar = duraklar
        .filter((d) => d.y > bas + 1 && (sutun < 0 || d.sutun < 0 || d.sutun === sutun))
        .map((d) => d.y - 2);
      return Math.min(icerikAlt, ...altlar);
    };
    const kutuYap = (sutun: number, ust: number, alt: number): Kutu => {
      const k = sinirlar.get(sutun)!;
      const x = Math.max(0, k.sol - 4);
      // Sol sütun sağ sütunun başlangıcını geçmesin.
      const sinir = sutun === 0 && s.bolmeX != null ? Math.max(sinirlar.get(1)!.sol - 1, s.bolmeX - 4) : s.genislik;
      const sag = Math.min(s.genislik, sinir, k.sag + 3);
      return { x, y: ust, w: sag - x, h: Math.max(8, alt - ust) };
    };
    for (const a of aciklar) a.soru.kutu = kutuYap(a.sutun, a.ust, altBul(a.sutun, a.bas));
    for (const p of grupParcalari) {
      const kutu = kutuYap(p.sutun, p.ust, altBul(p.sutun, p.ust));
      if (kutu.h > 10) p.grup.parcalar.push({ sayfa: s.sayfa, kutu });
    }
    // Sol sütunda başlayıp sağ yarıya taşan soru (sağda sahipsiz yazı varsa) tam genişlik olur.
    const sagKutular = [
      ...aciklar.filter((a) => a.sutun === 1).map((a) => a.soru.kutu),
      ...grupParcalari.filter((p) => p.sutun === 1).map((p) => p.grup.parcalar.find((x) => x.sayfa === s.sayfa)?.kutu),
    ].filter((k): k is Kutu => !!k);
    for (const a of aciklar) {
      if (a.sutun !== 0 || s.bolmeX == null) continue;
      const { y, h } = a.soru.kutu;
      const sahipsiz = satirlar.some(
        (l) =>
          l.sutun === 1 &&
          l.y > y + 2 &&
          l.y + l.h < y + h &&
          l.metin.length > 1 &&
          !sagKutular.some((k) => l.y >= k.y - 1 && l.y <= k.y + k.h)
      );
      // Sağ sütunda hiç soru yoksa sağdaki her şey (resim, şık) soldaki soruya aittir.
      const sagdaSoruYok = !aciklar.some((x) => x.sutun === 1);
      if (sahipsiz || sagdaSoruYok) a.soru.kutu = kutuYap(-1, a.ust, altBul(-1, a.bas));
    }
  }
  return { sorular, gruplar: gruplar.filter((g) => g.parcalar.length && sorular.some((q) => q.grupId === g.id)) };
}
