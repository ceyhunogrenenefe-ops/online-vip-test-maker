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

function boslukSonrasi(s: string, i: number): number {
  let k = i;
  while (k < s.length && /\s/.test(s[k])) k++;
  return k;
}

/**
 * Model bazen dizi içine virgül koymadan ikinci alan yazar ya da metnin
 * içindeki tırnağı kaçırır. JSON.parse o zaman "Expected ',' or '}'" der.
 * Burada yalnızca kapanıştan sonra gelen anahtar için virgül eklenir ve
 * dizgenin içindeki sahte tırnak kaçırılır.
 */
function jsonOnar(girdi: string): string {
  const s = girdi;
  let out = "";
  let i = 0;
  const virgulGerekirse = () => {
    const next = s[boslukSonrasi(s, i)];
    if (next === '"' || next === "{" || next === "[") out += ",";
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      out += '"';
      i++;
      while (i < s.length) {
        const ch = s[i];
        if (ch === "\\") {
          const n = s[i + 1] ?? "";
          const latex =
            n !== '"' &&
            n !== "\\" &&
            n !== "/" &&
            /[a-zA-Z]/.test(s[i + 2] ?? "");
          if (n === "u" && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) {
            out += s.slice(i, i + 6);
            i += 6;
          } else if (!latex && "\"\\/bfnrt".includes(n)) {
            out += "\\" + n;
            i += 2;
          } else {
            out += "\\\\" + n;
            i += n ? 2 : 1;
          }
          continue;
        }
        if (ch === "\n" || ch === "\r") {
          out += "\\n";
          i++;
          continue;
        }
        if (ch === '"') {
          const next = s[boslukSonrasi(s, i + 1)];
          const kapanir = next === undefined || ",}]:\"[{".includes(next);
          if (kapanir) {
            out += '"';
            i++;
            if (next === '"' || next === "{" || next === "[") out += ",";
            break;
          }
          out += '\\"';
          i++;
          continue;
        }
        out += ch;
        i++;
      }
      continue;
    }
    if (c === "}" || c === "]") {
      out += c;
      i++;
      virgulGerekirse();
      continue;
    }
    const soz = s.slice(i).match(/^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/);
    if (soz && (i === 0 || /[\s,:[{]/.test(s[i - 1]))) {
      out += soz[0];
      i += soz[0].length;
      virgulGerekirse();
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

function koseliKapanis(s: string, bas: number): number {
  let der = 0;
  let i = bas;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      i++;
      while (i < s.length) {
        if (s[i] === "\\") {
          i += 2;
          continue;
        }
        if (s[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "[") der++;
    else if (c === "]") {
      der--;
      if (der === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Kesilen yanıtın açık dizge ve parantezlerini kapatır. */
function jsonKapat(s: string): string {
  let out = "";
  const yigin: string[] = [];
  let str = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    out += c;
    if (str) {
      if (c === "\\") {
        out += s[i + 1] ?? "";
        if (s[i + 1]) i++;
        continue;
      }
      if (c === '"') str = false;
      continue;
    }
    if (c === '"') str = true;
    else if (c === "[") yigin.push("]");
    else if (c === "{") yigin.push("}");
    else if ((c === "]" || c === "}") && yigin[yigin.length - 1] === c) yigin.pop();
  }
  if (str) out += '"';
  while (yigin.length) out += yigin.pop();
  return out;
}

function jsonDene(parca: string): unknown | null {
  const aday = [parca, jsonOnar(parca), jsonOnar(jsonKapat(parca))];
  for (const p of aday) {
    try {
      return JSON.parse(p);
    } catch {
      /* sıradaki aday */
    }
  }
  return null;
}

/** Modelin döndürdüğü metinden JSON dizisini ayıklar. */
export function jsonAyikla(metin: string): unknown {
  const t = String(metin || "").trim();
  if (!t) throw new Error("Yanıt boş");
  const blok = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const ham = blok ? blok[1] : t;
  const parcalar: string[] = [];
  for (let i = 0; i < ham.length; i++) {
    if (ham[i] !== "[") continue;
    const sonra = ham[boslukSonrasi(ham, i + 1)];
    if (sonra !== "{" && sonra !== '"' && sonra !== "]") continue;
    const son = koseliKapanis(ham, i);
    parcalar.push(son > i ? ham.slice(i, son + 1) : jsonKapat(ham.slice(i)));
  }
  const ilk = ham.indexOf("[");
  const bitis = ham.lastIndexOf("]");
  if (ilk !== -1 && bitis > ilk) parcalar.push(ham.slice(ilk, bitis + 1));
  parcalar.sort((a, b) => b.length - a.length);
  for (const p of parcalar) {
    const veri = jsonDene(p);
    if (Array.isArray(veri)) return veri;
  }
  throw new Error("Modelin yanıtı okunamadı. Bir kez daha üretin.");
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
