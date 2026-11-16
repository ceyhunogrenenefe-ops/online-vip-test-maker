import { NextResponse } from "next/server";
import {
  DenemeHatasi,
  cevapKaydet,
  oturumGetir,
  sinavBasla,
  sinavGetir,
  sinavTeslim,
} from "@/lib/deneme/islem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function yanitla(e: unknown) {
  if (e instanceof DenemeHatasi) {
    return NextResponse.json({ hata: e.message }, { status: e.durum });
  }
  console.error(e);
  return NextResponse.json({ hata: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("op") === "oturum") {
      return NextResponse.json(await oturumGetir(url.searchParams.get("id") || ""));
    }
    return NextResponse.json(await sinavGetir(url.searchParams.get("kod") || ""));
  } catch (e) {
    return yanitla(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { op?: string };
    if (body.op === "basla") return NextResponse.json(await sinavBasla(body as never));
    if (body.op === "cevap") {
      const g = body as { oturumId?: string; cevaplar?: Record<string, unknown> };
      return NextResponse.json(await cevapKaydet(g.oturumId || "", g.cevaplar || {}));
    }
    if (body.op === "teslim") {
      const g = body as { oturumId?: string; cevaplar?: Record<string, unknown> };
      return NextResponse.json(await sinavTeslim(g.oturumId || "", g.cevaplar));
    }
    return NextResponse.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
  } catch (e) {
    return yanitla(e);
  }
}
