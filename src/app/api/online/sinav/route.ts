import { NextResponse } from "next/server";
import { OnlineHatasi, ogrenciTesti, teslimEt } from "@/lib/online/islem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Öğrenci tarafı (girişsiz): testi getir, teslim et. Cevap anahtarı öğrenciye gitmez. */
function yanitla(e: unknown) {
  if (e instanceof OnlineHatasi) return NextResponse.json({ hata: e.message }, { status: e.durum });
  console.error(e);
  return NextResponse.json({ hata: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    return NextResponse.json(await ogrenciTesti(new URL(req.url).searchParams.get("id")));
  } catch (e) {
    return yanitla(e);
  }
}

export async function POST(req: Request) {
  try {
    return NextResponse.json(await teslimEt((await req.json()) as Record<string, unknown>));
  } catch (e) {
    return yanitla(e);
  }
}
