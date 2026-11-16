/** Sayfa görseli üzerinde sütun boşluğu ve kenar kırpma hesapları (saf fonksiyonlar). */

/**
 * Sütun ayırıcıyı yatay şeritlerin oylamasıyla bulur. Her şerit, x başına
 * koyu piksel sayısıdır. Ortadaki %38–62 aralığında, yazı olan şeritlerin
 * en az %35'inde boş (ya da ince dikey çizgili) kalan x aranır; böylece
 * üstte tam genişlik bir soru olan sayfa da iki sütunlu tanınır.
 */
export function bolmeBul(seritler: ArrayLike<number>[], seritH: number): number | null {
  if (!seritler.length) return null;
  const W = seritler[0].length;
  if (W < 50) return null;
  const x0 = Math.floor(W * 0.38);
  const x1 = Math.ceil(W * 0.62);
  const minRun = Math.max(4, Math.round(W * 0.008));
  const oy = new Uint16Array(W);
  let dolu = 0;
  for (const s of seritler) {
    let sol = 0;
    let sag = 0;
    for (let x = 0; x < W; x++) {
      if (x < W / 2) sol += s[x];
      else sag += s[x];
    }
    if (sol < seritH * 0.5 || sag < seritH * 0.5) continue;
    dolu++;
    const bos = (x: number) => s[x] === 0 || s[x] >= seritH * 0.85;
    let bas = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      if (x <= x1 && bos(x)) {
        if (bas < 0) bas = x;
      } else if (bas >= 0) {
        if (x - bas >= minRun) for (let i = bas; i < x; i++) oy[i]++;
        bas = -1;
      }
    }
  }
  if (dolu < 3) return null;
  let en = 0;
  for (let x = x0; x <= x1; x++) en = Math.max(en, oy[x]);
  if (en < Math.max(3, dolu * 0.35)) return null;
  // Oyu tepeye yakın en geniş şerit: sağ sütundaki numara-metin aralığı
  // da oy alır ama sütun boşluğundan dardır.
  const esik = Math.max(3, dolu * 0.35, en * 0.75);
  let iyi = { bas: -1, uzun: 0 };
  let bas = -1;
  for (let x = x0; x <= x1 + 1; x++) {
    if (x <= x1 && oy[x] >= esik) {
      if (bas < 0) bas = x;
    } else if (bas >= 0) {
      if (x - bas > iyi.uzun) iyi = { bas, uzun: x - bas };
      bas = -1;
    }
  }
  // Geniş boşlukta ortayı değil sol kenara yakın noktayı al: sağ sütunun
  // numaraları boşluğa taşar ("3." sütun aralığının içinde durur).
  return iyi.bas + Math.min(iyi.uzun / 2, W * 0.02);
}

/** Beyaz kenarları atar; `beyaz(x,y)` pikselin boş olup olmadığını söyler. */
export function icerikSiniri(
  w: number,
  h: number,
  beyaz: (x: number, y: number) => boolean,
  pay = 6
): { x: number; y: number; w: number; h: number } | null {
  const satirDolu = (y: number) => {
    for (let x = 0; x < w; x += 1) if (!beyaz(x, y)) return true;
    return false;
  };
  const sutunDolu = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y += 1) if (!beyaz(x, y)) return true;
    return false;
  };
  let ust = 0;
  while (ust < h && !satirDolu(ust)) ust++;
  if (ust >= h) return null;
  let alt = h - 1;
  while (alt > ust && !satirDolu(alt)) alt--;
  let sol = 0;
  while (sol < w && !sutunDolu(sol, ust, alt)) sol++;
  let sag = w - 1;
  while (sag > sol && !sutunDolu(sag, ust, alt)) sag--;
  const x = Math.max(0, sol - pay);
  const y = Math.max(0, ust - pay);
  return { x, y, w: Math.min(w, sag + pay + 1) - x, h: Math.min(h, alt + pay + 1) - y };
}

export type Blob2 = { x: number; y: number; w: number; h: number };

/**
 * Sütunun sol kenarında tek başına duran küçük yazıları (soru numarası) bulur.
 * Satır başı kenara dayanan ama hemen ardından metin gelen satırlar elenir:
 * numaradan sonra en az yüksekliği kadar boşluk olmalı.
 */
export function kenarNumaralari(
  koyu: (x: number, y: number) => boolean,
  bolge: { x0: number; x1: number; y0: number; y1: number },
  yaziH: number,
  /** Bölme çizgisini geçen (tam genişlik) satırlar sağ sütunda sayılmaz. */
  atla: (y: number) => boolean = () => false
): Blob2[] {
  const { x0, x1, y0, y1 } = bolge;
  const solUc = new Int32Array(y1 - y0).fill(-1);
  let kenar = Infinity;
  for (let y = y0; y < y1; y++) {
    if (atla(y)) continue;
    for (let x = x0; x < x1; x++) {
      if (koyu(x, y)) {
        solUc[y - y0] = x;
        if (x < kenar) kenar = x;
        break;
      }
    }
  }
  if (!Number.isFinite(kenar)) return [];
  const bant = kenar + Math.max(10, (x1 - x0) * 0.04);
  const out: Blob2[] = [];
  let bas = -1;
  let bosluk = 0;
  const bitir = (son: number) => {
    const h = son - bas + 1;
    if (h >= yaziH * 0.45 && h <= yaziH * 2) {
      // Yatay yayılım: kenardan başlayıp ilk geniş boşluğa kadar.
      let sag = kenar;
      let bos = 0;
      for (let x = kenar; x < x1 && bos < yaziH * 1.2; x++) {
        let var_ = false;
        for (let y = bas; y <= son && !var_; y++) var_ = koyu(x, y + y0);
        if (var_) {
          sag = x;
          bos = 0;
        } else bos++;
      }
      const w = sag - kenar + 1;
      if (bos >= yaziH * 1.2 && w <= h * 2.8 && w >= 3) out.push({ x: kenar, y: bas + y0, w, h });
    }
    bas = -1;
  };
  for (let i = 0; i < solUc.length; i++) {
    const v = solUc[i];
    const kenarda = v >= 0 && v <= bant;
    if (kenarda) {
      if (bas < 0) bas = i;
      bosluk = 0;
    } else if (bas >= 0) {
      if (v < 0 && ++bosluk <= 2) continue;
      bitir(i - 1 - (v < 0 ? bosluk - 1 : 0));
      bosluk = 0;
    }
  }
  if (bas >= 0) bitir(solUc.length - 1);
  return out;
}

/**
 * Soru gövdesinden sonra uzun bir boş şerit varsa altındakini (sayfa altlığı,
 * numara dairesi vb.) atar. `dolu(y)` satırda mürekkep olup olmadığını söyler.
 */
export function boslukSonrasiniAt(h: number, dolu: (y: number) => boolean, enUzunBosluk: number): number {
  let icerikGoruldu = false;
  let bos = 0;
  for (let y = 0; y < h; y++) {
    if (dolu(y)) {
      icerikGoruldu = true;
      bos = 0;
    } else if (icerikGoruldu && ++bos >= enUzunBosluk) {
      return y - bos + 1;
    }
  }
  return h;
}
