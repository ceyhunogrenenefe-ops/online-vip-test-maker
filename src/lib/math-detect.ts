/**
 * "Bu satır matematik içeriyor olabilir mi?" sezgisi.
 *
 * NEDEN AYRI DOSYA VE NEDEN BÖYLE:
 * İlk sürüm `=`, `+`, `^` gibi işaretleri arıyordu. Gerçek OCR çıktısında
 * sınandığında HİÇBİR formülü yakalayamadı — çünkü Tesseract tam da bu
 * karakterleri bozuyor:
 *
 *   P = h · d · g      ->  P-h.d.g
 *   2x + 3y = 12       ->  2x 4* 3y — 12
 *   A = pi · r^2       ->  A - pi.r”2
 *
 * Bu yüzden dedektör, ideal girdiyi değil BOZULMUŞ çıktıyı tanıyacak
 * şekilde kuruldu: tek harflerin noktayla zincirlenmesi, harf+rakam
 * karışımı belirteçler ve OCR'ın ürettiği bozuk işaretler.
 *
 * Yanlış pozitif, yanlış negatiften iyidir: sonuç "OCR'a güvenme,
 * öğretmene sor" demek (spec 2: "tahmin ederek yanlış oluşturmasın").
 *
 * Not: Düzenli ifadeler ters bölü kaçışı kullanmadan, karakter sınıfları
 * açıkça yazılarak kuruldu; `\d` yazımı bir kez tek ters bölüye düşüp
 * rakam yerine "d" harfini aradığı için düz cümleler işaretlenmişti.
 */

const HARF = "A-Za-zÇĞİIÖŞÜçğıiöşü";
const RAKAM = "0-9";

/** Baştaki şık etiketi veya soru numarası: "A) ", "1. " */
const RE_ETIKET = new RegExp(
  "^[ \t]*(?:[" + HARF + "]|[" + RAKAM + "]{1,2})[ \t]*[).-][ \t]+"
);
/** OCR bozmadıysa doğrudan matematik olduğunu gösteren işaretler */
const RE_NET_MAT = /[=≠≤≥±×÷√∫∑∞π°]/;
const RE_KELIME = new RegExp("[" + HARF + "]{3,}");
const RE_HARF = new RegExp("[" + HARF + "]");
const RE_RAKAM = new RegExp("[" + RAKAM + "]");
const RE_SADECE_HARF = new RegExp("^[" + HARF + "]+[.,;:!?]?$");
/** Tek harflerin nokta/çarpı/tire ile zincirlenmesi: P-h.d.g, A-pi.r2 */
const RE_ZINCIR = new RegExp(
  "^[" + HARF + "][.·*×-](?:[" + HARF + RAKAM + "]+[.·*×-]?)+$"
);
/** OCR'ın matematiği bozarken ürettiği izler */
const RE_BOZUK = /[—~^*“”]|(?:^|[ ])[-–](?:[ ]|$)/;

export function matematikSupheliMi(satir: string): boolean {
  let s = String(satir || "").trim();
  if (!s) return false;
  s = s.replace(RE_ETIKET, "").trim();
  if (!s) return false;

  if (RE_NET_MAT.test(s)) return true;

  const tokenlar = s.split(/[ \t]+/).filter(Boolean);
  if (!tokenlar.length) return false;

  let kelime = 0;
  let karisik = 0;
  let zincir = 0;
  for (const t of tokenlar) {
    if (RE_KELIME.test(t)) kelime++;
    if (RE_HARF.test(t) && RE_RAKAM.test(t) && !RE_SADECE_HARF.test(t)) karisik++;
    if (RE_ZINCIR.test(t)) zincir++;
  }
  const bozuk = RE_BOZUK.test(s);

  if (zincir >= 1) return true;
  if (karisik >= 2) return true;
  if (karisik >= 1 && kelime <= 4) return true;
  if (bozuk && karisik >= 1) return true;
  if (bozuk && kelime <= 1 && tokenlar.length >= 3) return true;
  return false;
}

/** Dedektörün gerilemediğini doğrulayan örnekler (deneme sayfası kullanır). */
export const MATEMATIK_ORNEKLERI = {
  isaretlenmeli: [
    "P-h.d.g",
    "Ikinci derece denklem: 2x 4* 3y — 12",
    'Alan hesabi icin A - pi.r”2 kullanilir.',
    "P = h · d · g",
    "x = (-b ± √(b²-4ac)) / 2a",
    "2H2 + O2 -> 2H2O",
    "A - pi.r2",
    "F = m.a",
  ],
  isaretlenmemeli: [
    "Bu satir tamamen duz metindir.",
    "Sivi basinci formulu asagidaki gibidir.",
    "Derinlik arttikca basinc da artar. Kabin sekli",
    "A) Yariya iner",
    "D) Dort katina cikar",
    "1. Derinlik iki katina cikarsa basinc ne olur?",
    "SIVI BASINCI",
    "basinci etkilemez; yalnizca derinlik ve yogunluk",
    "onemlidir.",
    "Kuvvet artarsa basinc artar, yuzey alani artarsa basinc azalir.",
    "2. Dönem 1. Yazılı",
    "Öğrencinin adı ve soyadı",
  ],
};
