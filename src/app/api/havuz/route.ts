import { NextResponse } from "next/server";
import { HavuzHatasi } from "@/lib/havuz/depo";
import { bankaKaydet, havuzListesi, soruKaydet } from "@/lib/havuz/islem";
import { havuzKullanicisi } from "@/lib/havuz/kullanici";
import { havuzYaniti } from "@/lib/havuz/yanit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ben = await havuzKullanicisi();
    return NextResponse.json({ ...(await havuzListesi()), ben });
  } catch (e) {
    return havuzYaniti(e);
  }
}

export async function POST(req: Request) {
  try {
    const ben = await havuzKullanicisi();
    const govde = (await req.json().catch(() => null)) as { tur?: string; oge?: Record<string, unknown> } | null;
    if (!govde?.oge || typeof govde.oge !== "object") throw new HavuzHatasi("Kayıt eksik.", 400);
    if (govde.tur === "soru") return NextResponse.json(await soruKaydet(govde.oge, ben));
    if (govde.tur === "banka") return NextResponse.json(await bankaKaydet(govde.oge, ben));
    throw new HavuzHatasi("Bilinmeyen tür.", 400);
  } catch (e) {
    return havuzYaniti(e);
  }
}
