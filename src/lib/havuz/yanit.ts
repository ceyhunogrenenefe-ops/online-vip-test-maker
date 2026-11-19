import { NextResponse } from "next/server";
import { HavuzHatasi } from "./depo.ts";

export function havuzYaniti(e: unknown) {
  if (e instanceof HavuzHatasi) return NextResponse.json({ hata: e.message }, { status: e.durum });
  console.error(e);
  return NextResponse.json({ hata: "Soru havuzu işlemi tamamlanamadı." }, { status: 500 });
}
