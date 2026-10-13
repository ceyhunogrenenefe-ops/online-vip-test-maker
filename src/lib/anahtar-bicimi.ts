/**
 * Anahtarın BİÇİMİ hakkında, değerini sızdırmadan tanı bilgisi üretir.
 *
 * Neden gerekli: Anthropic "x-api-key header is required" döndüğünde
 * sorunun anahtarın kendisinde mi yoksa ortam değişkeninde mi olduğunu
 * ayırt etmek imkânsızdı. Vercel'de değişken "sensitive" işaretliyse
 * değeri ne CLI ne API geri verir; o yüzden teşhisi sunucunun kendisi
 * söylemek zorunda. Burada yalnızca uzunluk ve biçim bayrakları var —
 * anahtarın hiçbir parçası yazılmaz.
 */
export function anahtarBicimi(ham: string | undefined): string {
  const h = ham ?? "";
  const t = h.trim();
  const bayraklar = [
    `uzunluk=${t.length}`,
    `onek=${t.startsWith("sk-ant-") ? "sk-ant-" : "beklenmeyen"}`,
  ];
  if (h !== t) bayraklar.push("basta/sonda-bosluk-vardi");
  // Başlık değerine giremeyen karakterler (satır sonu, sekme, Unicode)
  const gecersiz = [...t].filter((c) => c.charCodeAt(0) < 33 || c.charCodeAt(0) > 126);
  if (gecersiz.length) {
    bayraklar.push(`gecersiz-karakter=${gecersiz.length}`);
    bayraklar.push(`ilk-gecersiz-kod=${gecersiz[0].charCodeAt(0)}`);
  }
  if (/^["']|["']$/.test(t)) bayraklar.push("tirnak-sarili");
  if (/^ANTHROPIC_API_KEY=/i.test(t)) bayraklar.push("degisken-adi-da-yapistirilmis");
  return bayraklar.join(", ");
}
