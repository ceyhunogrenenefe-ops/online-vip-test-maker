import { HavuzHatasi } from "@/lib/havuz/depo";
import { soruGorseli } from "@/lib/havuz/islem";
import { havuzKullanicisi } from "@/lib/havuz/kullanici";
import { havuzYaniti } from "@/lib/havuz/yanit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Baglam = { params: Promise<{ tur: string; id: string }> };

/** Havuz listesindeki küçük resimler. Adres ?v=güncelleme taşır, bu yüzden uzun önbellek güvenli. */
export async function GET(_req: Request, { params }: Baglam) {
  try {
    await havuzKullanicisi();
    const p = await params;
    if (p.tur !== "soru") throw new HavuzHatasi("Görsel yalnızca sorularda var.", 400);
    const { tur, bayt } = await soruGorseli(p.id);
    return new Response(new Uint8Array(bayt), {
      headers: { "Content-Type": tur, "Cache-Control": "private, max-age=604800, immutable" },
    });
  } catch (e) {
    return havuzYaniti(e);
  }
}
