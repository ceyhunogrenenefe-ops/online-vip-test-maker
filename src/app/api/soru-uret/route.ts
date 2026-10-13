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
import {
  MAX_SORU,
  jsonAyikla,
  sorulariDogrula,
} from "@/lib/soru-uret-ayristir";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

function hata(mesaj: string, kod = 400) {
  return NextResponse.json({ error: mesaj }, { status: kod });
}

export async function POST(req: Request) {
  const anahtar = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anahtar) {
    return hata(
      "ANTHROPIC_API_KEY tanımlı değil. Vercel > Project > Environment Variables bölümünden ekleyin.",
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

  try {
    const yanit = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anahtar,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: talimat }],
      }),
    });

    if (!yanit.ok) {
      const metin = await yanit.text().catch(() => "");
      // Anahtarı ya da ayrıntıyı istemciye sızdırmadan anlaşılır mesaj
      const kisa =
        yanit.status === 401
          ? "API anahtarı geçersiz"
          : yanit.status === 429
            ? "İstek sınırına takıldı, biraz sonra deneyin"
            : `Model servisi ${yanit.status} döndü`;
      console.error("[soru-uret]", yanit.status, metin.slice(0, 300));
      return hata(kisa, 502);
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
