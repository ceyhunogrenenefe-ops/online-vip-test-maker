/** Türkçe karşılaştırma ve sonuç yazımı. İ ve I karışmasın diye tr kurallarıyla katlanır. */

export function norm(s: string): string {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sayiYazi(n: number): string {
  const y = Math.round(n * 100) / 100;
  if (Number.isInteger(y)) return String(y);
  return y
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, "")
    .replace(".", ",");
}

/** Türkiye cep numarası → E.164. Uygun değilse null. */
export function telefonE164(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("90") && n.length === 12) n = n.slice(2);
  else if (n.startsWith("0") && n.length === 11) n = n.slice(1);
  if (n.length !== 10 || !n.startsWith("5")) return null;
  return `+90${n}`;
}

export function telefonMaske(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 6) return "kayıtlı numara";
  return `0${d.slice(-10, -8)}** *** ** ${d.slice(-2)}`;
}
