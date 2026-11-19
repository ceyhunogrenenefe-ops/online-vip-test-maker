import { NextResponse } from "next/server";
import { HavuzHatasi } from "@/lib/havuz/depo";
import { ogeGetir, ogeKaldir } from "@/lib/havuz/islem";
import { havuzKullanicisi } from "@/lib/havuz/kullanici";
import { havuzYaniti } from "@/lib/havuz/yanit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Baglam = { params: Promise<{ tur: string; id: string }> };

function tur(t: string): "soru" | "banka" {
  if (t === "soru" || t === "banka") return t;
  throw new HavuzHatasi("Bilinmeyen tür.", 400);
}

export async function GET(_req: Request, { params }: Baglam) {
  try {
    await havuzKullanicisi();
    const p = await params;
    return NextResponse.json(await ogeGetir(tur(p.tur), p.id));
  } catch (e) {
    return havuzYaniti(e);
  }
}

export async function DELETE(_req: Request, { params }: Baglam) {
  try {
    const ben = await havuzKullanicisi();
    const p = await params;
    await ogeKaldir(tur(p.tur), p.id, ben);
    return NextResponse.json({ tamam: true });
  } catch (e) {
    return havuzYaniti(e);
  }
}
