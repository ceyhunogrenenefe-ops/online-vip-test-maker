/**
 * Modelden gelen yanıtın ayrıştırılması ve doğrulanması.
 *
 * Rota dosyasından ayrı tutuldu çünkü asıl risk burada: model bazen
 * kod bloğu içinde, bazen açıklama cümlesiyle birlikte, bazen eksik
 * alanlarla döner. Eksik ya da tutarsız soruyu "düzeltmek" yerine
 * ATIYORUZ — yanlış cevap anahtarıyla föye giren bir soru, hiç
 * üretilmemiş sorudan kötüdür.
 */

export type UretilenSoru = {
  stem: string;
  options: { label: string; text: string }[];
  answer: string;
  explanation?: string;
};

export const MAX_SORU = 5;

/** Modelin döndürdüğü metinden JSON dizisini ayıklar. */
export function jsonAyikla(metin: string): unknown {
  const t = String(metin || "").trim();
  if (!t) throw new Error("Yanıt boş");
  const blok = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const ham = blok ? blok[1] : t;
  const bas = ham.indexOf("[");
  const son = ham.lastIndexOf("]");
  if (bas === -1 || son === -1 || son <= bas) {
    throw new Error("Yanıtta JSON bulunamadı");
  }
  return JSON.parse(ham.slice(bas, son + 1));
}

export function sorulariDogrula(veri: unknown): UretilenSoru[] {
  if (!Array.isArray(veri)) throw new Error("Yanıt bir liste değil");
  const out: UretilenSoru[] = [];
  for (const s of veri.slice(0, MAX_SORU)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const stem = typeof o.stem === "string" ? o.stem.trim() : "";
    const answer =
      typeof o.answer === "string" ? o.answer.trim().toLocaleUpperCase("tr-TR") : "";
    const ham = Array.isArray(o.options) ? o.options : [];
    const options = ham
      .map((x) => {
        const r = (x || {}) as Record<string, unknown>;
        return {
          label: String(r.label ?? "").trim().toLocaleUpperCase("tr-TR"),
          text: String(r.text ?? "").trim(),
        };
      })
      .filter((x) => x.label && x.text);

    if (!stem || options.length < 3) continue;
    // Aynı etiket iki kez gelirse soru bozuktur
    if (new Set(options.map((x) => x.label)).size !== options.length) continue;
    // Cevap anahtarı şıklardan biri değilse soru güvenilmezdir
    if (!options.some((x) => x.label === answer)) continue;

    out.push({
      stem,
      options,
      answer,
      explanation:
        typeof o.explanation === "string" && o.explanation.trim()
          ? o.explanation.trim()
          : undefined,
    });
  }
  if (!out.length) throw new Error("Geçerli soru üretilemedi");
  return out;
}
