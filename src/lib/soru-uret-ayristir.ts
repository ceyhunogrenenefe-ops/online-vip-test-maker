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

export const MAX_SORU = 8;

export const SORU_TIPLERI = [
  "Açık uçlu",
  "Kısa cevaplı",
  "Çoktan seçmeli",
  "Doğru / yanlış",
  "Boşluk doldurma",
  "Eşleştirme",
  "Yeni nesil",
  "Problem çözme",
  "Grafik ve tablo yorumlama",
  "Geometrik şekilli",
  "Günlük yaşam senaryolu",
] as const;

export type SoruTipi = (typeof SORU_TIPLERI)[number];

export const ZORLUKLAR = ["Kolay", "Orta", "Zor", "Karma"] as const;

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

function soruModu(tip: string): "mc" | "dy" | "serbest" {
  if (tip === "Çoktan seçmeli") return "mc";
  if (tip === "Doğru / yanlış") return "dy";
  return "serbest";
}

/**
 * Soru tipine göre doğrulama. Çoktan seçmelide cevap şıklardan biri değilse
 * soru atılır. Açık uçluda cevap boş kalabilir; sistem cevap uydurmaz.
 */
export function sorulariDogrulaGenis(veri: unknown, tip: string): UretilenSoru[] {
  const mod = soruModu(tip);
  if (mod === "mc") return sorulariDogrula(veri);
  if (!Array.isArray(veri)) throw new Error("Yanıt bir liste değil");
  const out: UretilenSoru[] = [];
  for (const s of veri.slice(0, MAX_SORU)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const stem = typeof o.stem === "string" ? o.stem.trim() : "";
    if (stem.length < 8) continue;
    const answer = typeof o.answer === "string" ? o.answer.trim() : "";
    const ham = Array.isArray(o.options) ? o.options : [];
    const options = ham
      .map((x) => {
        const r = (x || {}) as Record<string, unknown>;
        return {
          label: String(r.label ?? "").trim(),
          text: String(r.text ?? "").trim(),
        };
      })
      .filter((x) => x.label && x.text);
    const explanation =
      typeof o.explanation === "string" && o.explanation.trim()
        ? o.explanation.trim()
        : undefined;

    if (mod === "dy") {
      const cevap = answer.toLocaleUpperCase("tr-TR");
      const siklar = options.map((x) => ({
        ...x,
        label: x.label.toLocaleUpperCase("tr-TR"),
      }));
      if (siklar.length !== 2) continue;
      if (new Set(siklar.map((x) => x.label)).size !== 2) continue;
      if (!siklar.some((x) => x.label === cevap)) continue;
      out.push({ stem, options: siklar, answer: cevap, explanation });
      continue;
    }

    const etiketli = options.length >= 2 && new Set(options.map((x) => x.label)).size === options.length;
    const cevapUyar = answer && etiketli && options.some((x) => x.label === answer);
    out.push({
      stem,
      options: cevapUyar ? options : [],
      answer: cevapUyar ? answer : answer && !etiketli ? answer : "",
      explanation,
    });
  }
  if (!out.length) throw new Error("Geçerli soru üretilemedi");
  return out;
}

/** Otomatik yapılamayan kontroller öğretmenin önüne not olarak konur. */
export function yzKaliteUyarilari(sorular: UretilenSoru[], resmi = false): string[] {
  const notlar = [
    "Matematiksel işlem bu sistemde ayrıca hesaplanmadı.",
    "Sınıf seviyesi, çözülebilirlik ve dil bilgisi otomatik onaylanmadı.",
    resmi
      ? "Seçilen öğrenme çıktısı ODSGM 2026-2027 1. dönem konu soru dağılım tablosunda kayıtlı. Üretilen sorunun bu çıktıyı ölçtüğü MEB tarafından onaylanmadı."
      : "MEB kazanım uyumu doğrulanmadı: seçilen metin resmî tabloda yok ya da seçilmedi.",
    "Birden fazla doğru ihtimali otomatik elenemez; şıkları siz kontrol edin.",
  ];
  const govdeler = sorular.map((s) => s.stem.toLocaleLowerCase("tr-TR").replace(/\s+/g, " "));
  const tekrar = govdeler.filter((g, i) => govdeler.indexOf(g) !== i);
  if (tekrar.length) notlar.unshift("Birbirine çok benzeyen soru kökleri var.");
  if (sorular.some((s) => !s.answer.trim())) {
    notlar.unshift("Bazı sorularda cevap boş bırakıldı. Sistem cevap uydurmadı.");
  }
  return notlar;
}
