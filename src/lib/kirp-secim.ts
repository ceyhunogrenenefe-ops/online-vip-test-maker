import type { PixelCrop } from "./crop";

/** Seçim kutusunun tutamağı. `tasi` kutunun içinden sürüklemedir. */
export type SecimKenari = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "tasi";

const MIN = 12;

/** Seçimi sayfa sınırının içinde tutar. */
export function secimiSinirla(c: PixelCrop, genislik: number, yukseklik: number): PixelCrop {
  let { x, y, width, height } = c;
  width = Math.max(MIN, Math.min(width, genislik));
  height = Math.max(MIN, Math.min(height, yukseklik));
  x = Math.max(0, Math.min(x, genislik - width));
  y = Math.max(0, Math.min(y, yukseklik - height));
  return { x, y, width, height };
}

/**
 * Mevcut seçimi kenarından veya içinden oynatır.
 * dx/dy, sürüklemenin başladığı noktaya göre piksel farkıdır.
 */
export function secimiUygula(
  bas: PixelCrop,
  dx: number,
  dy: number,
  kenar: SecimKenari,
  genislik: number,
  yukseklik: number
): PixelCrop {
  if (kenar === "tasi") {
    return secimiSinirla(
      { x: bas.x + dx, y: bas.y + dy, width: bas.width, height: bas.height },
      genislik,
      yukseklik
    );
  }
  let left = bas.x;
  let right = bas.x + bas.width;
  let top = bas.y;
  let bottom = bas.y + bas.height;
  if (kenar.includes("w")) left += dx;
  if (kenar.includes("e")) right += dx;
  if (kenar.includes("n")) top += dy;
  if (kenar.includes("s")) bottom += dy;
  if (right < left) [left, right] = [right, left];
  if (bottom < top) [top, bottom] = [bottom, top];
  left = Math.max(0, Math.min(left, Math.max(0, genislik - MIN)));
  right = Math.max(left + MIN, Math.min(right, genislik));
  top = Math.max(0, Math.min(top, Math.max(0, yukseklik - MIN)));
  bottom = Math.max(top + MIN, Math.min(bottom, yukseklik));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Pozitif adım her kenarı dışarı açar, negatif adım içeri alır. */
export function secimiGenislet(
  c: PixelCrop,
  adim: number,
  genislik: number,
  yukseklik: number
): PixelCrop {
  const width = Math.max(MIN, Math.min(genislik, c.width + adim * 2));
  const height = Math.max(MIN, Math.min(yukseklik, c.height + adim * 2));
  return secimiSinirla(
    {
      x: c.x - (width - c.width) / 2,
      y: c.y - (height - c.height) / 2,
      width,
      height,
    },
    genislik,
    yukseklik
  );
}
