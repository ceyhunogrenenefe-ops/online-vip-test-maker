import { sayiYazi } from "./turkce.ts";

export function smsMetni(p: {
  ad: string;
  soyad: string;
  deneme: string;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
}): string {
  const ad = `${p.ad} ${p.soyad}`.replace(/\s+/g, " ").trim();
  return `Online VIP Dershane | ${ad}, ${p.deneme} sınavını tamamladı. Doğru ${p.dogru}, yanlış ${p.yanlis}, boş ${p.bos}, net ${sayiYazi(p.net)}.`;
}
