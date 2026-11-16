import { gorselGetir } from "@/lib/deneme/depo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Online sınav soru görseli. Öğrenci linkinden açıldığı için girişsizdir; kimlik tahmin edilemez UUID'dir. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const veri = await gorselGetir(id);
  if (!veri) return new Response("Görsel bulunamadı.", { status: 404 });
  return new Response(Buffer.from(veri), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
