import type { DocBlock } from "./pdf-blocks";

/**
 * Föy yerleşim planlayıcısı — saf hesap, çizim yok.
 *
 * NEDEN ÇİZİMDEN AYRI
 * Yerleşim muhasebesi (hangi blok hangi sütuna, ne düştü, ne zorlandı)
 * en kırılgan parça: önceki gömülü sürüm güvenlik sayacı dolduğunda
 * kalan blokları sessizce düşürüyordu. jsPDF'e bağlı bir fonksiyonu
 * test etmek için tarayıcı gerekir; bu modülün ÇALIŞMA ZAMANINDA
 * hiçbir bağımlılığı yok (DocBlock yalnızca tip olarak alınıyor),
 * dolayısıyla doğrudan Node ile sınanabiliyor.
 *
 * Ölçme çizimden önce yapılabilir: blok yüksekliği yalnızca bloğa ve
 * sütun genişliğine bağlı, çizim sırası yüksekliği değiştirmiyor.
 */

export type YerlesenBlok = {
  blok: DocBlock;
  /** Kaynak dizideki sırası — teşhis ve düzenleyici eşlemesi için */
  indeks: number;
  /** Sütun içindeki çizim y değeri (mm) */
  y: number;
  /** Sütuna sığmadığı halde zorla yerleştirildi mi */
  zorlandi: boolean;
  /** Sayfa genişliğini kullanır; iki sütunun arasına çizgi girmez */
  tamGenislik?: boolean;
  yukseklikMm?: number;
};

export type FoySayfaPlani = {
  /** Sayfadaki sütunlar. Tek sütun modunda dizi uzunluğu 1'dir. */
  sutunlar: YerlesenBlok[][];
};

export type FoyPlan = {
  sayfalar: FoySayfaPlani[];
  /** Sığmadığı halde zorla çizilen blokların kaynak indeksleri */
  zorlanan: number[];
  /** Sayfa sınırı dolduğu için hiç yerleştirilemeyen blok indeksleri */
  dusen: number[];
};

export type FoyPlanSecenek = {
  /** Sütun içeriğinin başladığı y (mm) */
  ustY: number;
  /** İçeriğin geçemeyeceği alt sınır (mm) */
  altSinir: number;
  /** Kaçak sayfa üretimine karşı üst sınır */
  maksSayfa: number;
  /** Sayfa başına sütun sayısı */
  sutunSayisi?: number;
  /**
   * Sığmayan çözüm boşluğunu kısaltır. Soru sırası değişmez.
   * Sütun dibinde koca boşluk bırakıp tüm satırları sonraya atmaz.
   */
  akilli?: boolean;
};

/**
 * Blokları sütunlara ve sayfalara akıtır.
 * @param olc blok yüksekliğini mm olarak döndürür. İkinci argüman sayfa genişliğinde ölçüldüğünü söyler.
 */
export function foyYerlesimPlani(
  bloklar: DocBlock[],
  olc: (blok: DocBlock, tamGenislik?: boolean) => number,
  secenek: FoyPlanSecenek
): FoyPlan {
  const sutunSayisi = Math.max(1, secenek.sutunSayisi ?? 2);
  const sayfalar: FoySayfaPlani[] = [];
  const zorlanan: number[] = [];

  let i = 0;
  while (i < bloklar.length && sayfalar.length < secenek.maksSayfa) {
    const sutunlar: YerlesenBlok[][] = Array.from({ length: sutunSayisi }, () => []);
    let s = 0;
    let y = secenek.ustY;
    /** İki sütunun yeniden başladığı çizgi. Geniş soru bunun üstündedir. */
    let taban = secenek.ustY;
    let sayfaKapandi = false;

    const koy = (blok: DocBlock, indeks: number, yy: number, zorlandi: boolean, tam: boolean) => {
      const h = olc(blok, tam);
      const hedef = tam ? 0 : s;
      sutunlar[hedef].push({
        blok,
        indeks,
        y: yy,
        zorlandi,
        tamGenislik: tam || undefined,
        yukseklikMm: h,
      });
      return h;
    };

    const bantBos = () => !sutunlar[s].some((v) => !v.tamGenislik && v.y >= taban - 0.01);

    while (i < bloklar.length && !sayfaKapandi) {
      const blok = bloklar[i];

      // Öğretmenin koyduğu kesmeler otomatik akıştan önce gelir ve silinmez.
      if (blok.kind === "pageBreak") {
        i++;
        break;
      }
      if (blok.kind === "columnBreak") {
        i++;
        s += 1;
        y = taban;
        if (s >= sutunSayisi) sayfaKapandi = true;
        continue;
      }

      if (sutunSayisi > 1 && blok.tamGenislik) {
        const dip = sutunlar.flat().reduce((d, v) => Math.max(d, v.y + (v.yukseklikMm ?? olc(v.blok, v.tamGenislik))), taban);
        let aday: DocBlock = blok;
        let h = olc(aday, true);
        if (dip + h > secenek.altSinir && secenek.akilli && blok.kind === "answerLines" && blok.count > 1) {
          const kalan = secenek.altSinir - dip;
          for (let n = blok.count - 1; n >= 1; n--) {
            const kisa: DocBlock = { ...blok, count: n };
            if (olc(kisa, true) <= kalan) {
              aday = kisa;
              h = olc(kisa, true);
              break;
            }
          }
        }
        if (dip + h > secenek.altSinir && dip > secenek.ustY) {
          sayfaKapandi = true;
          continue;
        }
        const zorlandi = dip + h > secenek.altSinir;
        if (zorlandi) zorlanan.push(i);
        const yerH = koy(aday, i, dip, zorlandi, true);
        taban = dip + yerH;
        y = taban;
        s = 0;
        i++;
        continue;
      }

      const h = olc(blok, false);
      if (y + h > secenek.altSinir && secenek.akilli && blok.kind === "answerLines" && blok.count > 1) {
        const kalan = secenek.altSinir - y;
        let sigan: DocBlock | null = null;
        for (let n = blok.count - 1; n >= 1; n--) {
          const kisa: DocBlock = { ...blok, count: n };
          if (olc(kisa, false) <= kalan) {
            sigan = kisa;
            break;
          }
        }
        if (sigan) {
          y += koy(sigan, i, y, false, false);
          i++;
          continue;
        }
      }
      if (y + h > secenek.altSinir) {
        // Sütun boşken bile sığmıyorsa blok bir sütundan uzundur.
        // Atlanırsa içerik eksilir; sığdırmadan çizilir ve bildirilir.
        // Eski davranış: zorlanan bloktan sonra aynı sütuna devam edilmez.
        if (bantBos()) {
          koy(blok, i, y, true, false);
          zorlanan.push(i);
          i++;
        }
        s += 1;
        y = taban;
        if (s >= sutunSayisi) sayfaKapandi = true;
        continue;
      }

      y += koy(blok, i, y, false, false);
      i++;
    }

    sayfalar.push({ sutunlar });
  }

  const dusen: number[] = [];
  for (let k = i; k < bloklar.length; k++) dusen.push(k);

  return { sayfalar, zorlanan, dusen };
}

/** Plandaki toplam yerleşen blok sayısı */
export function planBlokSayisi(plan: FoyPlan): number {
  let n = 0;
  for (const s of plan.sayfalar) for (const c of s.sutunlar) n += c.length;
  return n;
}
