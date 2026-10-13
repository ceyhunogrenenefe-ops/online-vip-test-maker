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
};

export type FoySayfaPlani = {
  /** Her sayfada iki sütun */
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
};

/**
 * Blokları sütunlara ve sayfalara akıtır.
 * @param olc blok yüksekliğini mm olarak döndürür
 */
export function foyYerlesimPlani(
  bloklar: DocBlock[],
  olc: (blok: DocBlock) => number,
  secenek: FoyPlanSecenek
): FoyPlan {
  const sutunSayisi = Math.max(1, secenek.sutunSayisi ?? 2);
  const sayfalar: FoySayfaPlani[] = [];
  const zorlanan: number[] = [];

  let i = 0;
  while (i < bloklar.length && sayfalar.length < secenek.maksSayfa) {
    const sutunlar: YerlesenBlok[][] = [];
    for (let s = 0; s < sutunSayisi; s++) {
      const sutun: YerlesenBlok[] = [];
      let y = secenek.ustY;
      while (i < bloklar.length) {
        const blok = bloklar[i];
        const h = olc(blok);
        if (y + h > secenek.altSinir) {
          // Sütun boşken bile sığmıyorsa blok bir sütundan uzun demektir.
          // Atlanırsa öğretmenin föyünden içerik eksilir; bu yüzden
          // sığdırmadan çizilir ve zorlanan olarak bildirilir.
          if (sutun.length === 0) {
            sutun.push({ blok, indeks: i, y, zorlandi: true });
            zorlanan.push(i);
            i++;
          }
          break;
        }
        sutun.push({ blok, indeks: i, y, zorlandi: false });
        y += h;
        i++;
      }
      sutunlar.push(sutun);
      if (i >= bloklar.length) break;
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
