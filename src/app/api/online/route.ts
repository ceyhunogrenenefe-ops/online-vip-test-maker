import { NextResponse } from "next/server";
import { OnlineHatasi, gorselYukle, testSil, testVarMi, testYayinla, teslimler } from "@/lib/online/islem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Öğretmen tarafı: Online Testlerim. Giriş kapısı (middleware) arkasındadır. */
function yanitla(e: unknown) {
  if (e instanceof OnlineHatasi) return NextResponse.json({ hata: e.message }, { status: e.durum });
  console.error(e);
  return NextResponse.json({ hata: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const id = url.searchParams.get("id");
    if (url.searchParams.get("op") === "var") return NextResponse.json({ var: await testVarMi(id) });
    return NextResponse.json({ teslimler: await teslimler(id) });
  } catch (e) {
    return yanitla(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    switch (body.op) {
      case "gorsel":
        return NextResponse.json(await gorselYukle(body.id, body.n, body.veri));
      case "yayinla":
        return NextResponse.json(await testYayinla(body));
      case "sil":
        return NextResponse.json(await testSil(body.id));
      default:
        return NextResponse.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
    }
  } catch (e) {
    return yanitla(e);
  }
}
