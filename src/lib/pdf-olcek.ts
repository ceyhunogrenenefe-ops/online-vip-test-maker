/** Tarayıcı tuvali bu kenarı veya alanı aşınca sayfa çizimi düşer ya da bulanıklaşır. */
export const PDF_MAKS_KENAR = 8192;
export const PDF_MAKS_ALAN = 16_000_000;

/**
 * İstenen PDF ölçeğini, sayfa tuvale sığacak en yüksek netlikte tutar.
 * Sığan ölçek olduğu gibi kalır.
 */
export function guvenliPdfOlcegi(istenen: number, genislik: number, yukseklik: number): number {
  if (!(istenen > 0) || !(genislik > 0) || !(yukseklik > 0)) return 1;
  let olcek = istenen;
  const kenar = Math.max(genislik, yukseklik) * olcek;
  if (kenar > PDF_MAKS_KENAR) olcek *= PDF_MAKS_KENAR / kenar;
  const alan = genislik * olcek * yukseklik * olcek;
  if (alan > PDF_MAKS_ALAN) olcek *= Math.sqrt(PDF_MAKS_ALAN / alan);
  return olcek;
}
