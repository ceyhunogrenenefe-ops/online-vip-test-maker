/**
 * Alternatif soru üretimi — Claude API.
 *
 * API ANAHTARI YALNIZCA BURADA: bu bir sunucu rotası, anahtar istemciye
 * hiç düşmez (spec 10: "API anahtarlarını istemci tarafında açık bırakma").
 *
 * Üretilen sorular TASLAKTIR. Öğretmen görmeden hiçbir şey föye girmez;
 * arayüz bunu açıkça yazar (spec kural 5).
 */

import { NextResponse } from "next/server";
import { anahtarBicimi } from "@/lib/anahtar-bicimi";
import {
  MAX_SORU,
  jsonAyikla,
  sorulariDogrula,
} from "@/lib/soru-uret-ayristir";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

/**
 * Kuruluş düzeyinde (çalışma alanına bağlı olmayan) bir API anahtarı
 * kullanılıyorsa Anthropic `anthropic-workspace-id` başlığını zorunlu
 * tutuyor ve aksi halde 400 dönüyor. Çalışma alanına bağlı anahtarda
 * bu değişken gereksizdir.
 */
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID?.trim();

function hata(mesaj: string, kod = 400) {
  return NextResponse.json({ error: mesaj }, { status: kod });
}

export async function POST(req: Request) {
  const anahtarHam = process.env.ANTHROPIC_API_KEY;
  const anahtar = anahtarHam?.trim();
  if (!anahtar) {
    return hata(
      "ANTHROPIC_API_KEY tanımlı değil. Vercel > Project > Environment Variables bölümünden ekleyin.",
      503
    );
  }

  /**
   * Başlığa giremeyecek bir karakter varsa fetch TypeError atar ve hata
   * "Soru üretilemedi" diye görünür. Önden yakalayıp ne olduğunu söylüyoruz.
   */
  if ([...anahtar].some((c) => c.charCodeAt(0) < 33 || c.charCodeAt(0) > 126)) {
    return hata(
      `ANTHROPIC_API_KEY başlık olarak gönderilemeyecek karakter içeriyor (${anahtarBicimi(anahtarHam)}). ` +
        "Vercel'de değişkeni silip anahtarı tırnaksız, boşluksuz, tek satır olarak yeniden ekleyin.",
      503
    );
  }

  let govde: {
    kaynakSoru?: string;
    sinif?: string;
    brans?: string;
    konu?: string;
    adet?: number;
    zorluk?: "kolay" | "orta" | "zor";
  };
  try {
    govde = await req.json();
  } catch {
    return hata("Geçersiz istek gövdesi");
  }

  const kaynak = (govde.kaynakSoru || "").trim();
  if (!kaynak) return hata("Kaynak soru gerekli");
  if (kaynak.length > 4000) return hata("Kaynak soru çok uzun");

  const adet = Math.min(MAX_SORU, Math.max(1, Number(govde.adet) || 3));
  const zorluk = govde.zorluk || "orta";

  const talimat = [
    "Sen Türkiye'de bir dershanede çalışan deneyimli bir öğretmensin.",
    "Sana verilen ÖRNEK SORUYA benzer, aynı kazanımı ölçen ALTERNATİF sorular yazacaksın.",
    "",
    "Kurallar:",
    "- Örnek soruyu kopyalama; sayıları, bağlamı ve ifadeleri değiştir.",
    "- Aynı konuyu ve aynı zorluk seviyesini koru.",
    "- MEB müfredatına ve yeni nesil senaryo temelli soru anlayışına uygun yaz.",
    "- Her soruda 4 şık olsun (A, B, C, D) ve yalnızca biri doğru olsun.",
    "- Çeldiriciler mantıklı olsun; rastgele sayı yazma.",
    "- Türkçe yazım ve noktalama kurallarına uy.",
    "- Emin olmadığın bir bilgiyi uydurma.",
    "",
    `Sınıf: ${govde.sinif || "belirtilmedi"}`,
    `Branş: ${govde.brans || "belirtilmedi"}`,
    `Konu: ${govde.konu || "belirtilmedi"}`,
    `Zorluk: ${zorluk}`,
    `Üretilecek soru sayısı: ${adet}`,
    "",
    "ÖRNEK SORU:",
    kaynak,
    "",
    "Yanıtı YALNIZCA şu JSON dizisi olarak ver, başka hiçbir şey yazma:",
    '[{"stem":"soru kökü","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"answer":"A","explanation":"kısa çözüm"}]',
  ].join("\n");

  /**
   * Başlıklar düz nesne yerine Headers ile kuruluyor ve istek
   * önbelleğe alınmıyor.
   *
   * Neden: Anthropic 401 "x-api-key header is required" döndü, oysa
   * başlık koşulsuz gönderiliyor ve değerin biçimi ölçüldü (110 karakter,
   * sk-ant- öneki, geçersiz karakter yok). Next uygulama yönlendiricisi
   * global fetch'i sarmalıyor; düz nesne başlıkların sarmalayıcıda
   * kaybolmadığını Headers ile kurarak kesinleştiriyoruz. no-store de
   * model yanıtının önbelleğe alınmasını engelliyor — bu çağrının
   * önbelleklenmesi zaten istenmez.
   */
  const basliklar = new Headers();
  basliklar.set("content-type", "application/json");
  basliklar.set("x-api-key", anahtar);
  basliklar.set("anthropic-version", "2023-06-01");
  if (WORKSPACE_ID) basliklar.set("anthropic-workspace-id", WORKSPACE_ID);

  try {
    const yanit = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      cache: "no-store",
      headers: basliklar,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: talimat }],
      }),
    });

    if (!yanit.ok) {
      const metin = await yanit.text().catch(() => "");
      console.error("[soru-uret]", yanit.status, metin.slice(0, 400));

      /**
       * Yapılandırma hatasının kendisi gizli bilgi değil ve asıl sorunu
       * yalnızca o anlatıyor. "Model servisi 400 döndü" demek, çalışma
       * alanı başlığının eksik olduğunu bulmayı gereksiz yere zorlaştırdı.
       * Bu yüzden Anthropic'in açıklamasını geçiriyoruz — anahtar bu
       * metinde yer almaz.
       */
      let ayrinti = "";
      try {
        const j = JSON.parse(metin) as { error?: { message?: string } };
        ayrinti = String(j.error?.message || "").slice(0, 300);
      } catch {
        /* JSON değilse ayrıntı verilmez */
      }

      const kisa =
        yanit.status === 401
          ? "API anahtarı geçersiz"
          : yanit.status === 429
            ? "İstek sınırına takıldı, biraz sonra deneyin"
            : `Model servisi ${yanit.status} döndü`;

      /**
       * Kimlik hatalarında anahtarın BİÇİMİNİ de bildiriyoruz. Anahtarın
       * kendisi yazılmaz; yalnızca uzunluk ve biçim bayrakları. Bunsuz
       * "anahtar yanlış mı, ortam değişkeni mi bozuk" sorusu Vercel'de
       * sensitive değişkenler okunamadığı için yanıtlanamıyor.
       */
      let ek =
        yanit.status === 401 || yanit.status === 403
          ? ` [anahtar: ${anahtarBicimi(anahtarHam)}]`
          : "";

      /**
       * "x-api-key header is required" hem başlığın hiç ulaşmaması hem de
       * başka bir nedenle olabilir. Suçun bizde mi (istek kurulumu) yoksa
       * anahtarda mı olduğunu ayırmak için aynı başlıkla küçük bir GET
       * atıyoruz:
       *   "...header is required" tekrar gelirse  -> başlık gerçekten gitmiyor
       *   "invalid x-api-key" gelirse             -> anahtar reddediliyor
       *   başarılı olursa                         -> anahtar geçerli, sorun
       *                                              /v1/messages isteğinde
       */
      if (yanit.status === 401 && /header is required/i.test(ayrinti)) {
        try {
          const sonda = await fetch("https://api.anthropic.com/v1/models?limit=1", {
            method: "GET",
            cache: "no-store",
            headers: basliklar,
          });
          const sondaMetin = await sonda.text().catch(() => "");
          let sondaAyrinti = "";
          try {
            const sj = JSON.parse(sondaMetin) as { error?: { message?: string } };
            sondaAyrinti = String(sj.error?.message || "").slice(0, 120);
          } catch {
            /* JSON degilse ayrinti yok */
          }
          console.error("[soru-uret sonda]", sonda.status, sondaMetin.slice(0, 200));
          ek +=
            ` [sonda /v1/models: ${sonda.status}` +
            (sondaAyrinti ? ` ${sondaAyrinti}` : " basarili") +
            "]";
        } catch (se) {
          ek += ` [sonda basarisiz: ${se instanceof Error ? se.message : "bilinmiyor"}]`;
        }
      }

      return hata((ayrinti ? `${kisa} — ${ayrinti}` : kisa) + ek, 502);
    }

    const j = (await yanit.json()) as {
      content?: { type: string; text?: string }[];
    };
    const metin = (j.content || [])
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text as string)
      .join("\n");
    if (!metin.trim()) return hata("Model boş yanıt döndü", 502);

    const sorular = sorulariDogrula(jsonAyikla(metin));
    return NextResponse.json({ sorular, model: MODEL });
  } catch (e) {
    console.error("[soru-uret]", e);
    return hata(
      e instanceof Error ? e.message : "Soru üretilemedi",
      502
    );
  }
}
