import { soruGorseli } from "@/lib/online/islem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Online test soru görseli. Öğrenci linkinden açıldığı için girişsizdir. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  try {
    const g = await soruGorseli(u.get("id"), u.get("n"));
    if (!g) return new Response("Görsel bulunamadı.", { status: 404 });
    return new Response(Buffer.from(g.veri), {
      headers: { "Content-Type": g.tur, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Görsel bulunamadı.", { status: 404 });
  }
}
