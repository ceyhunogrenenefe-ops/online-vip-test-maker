import { NextResponse } from "next/server";
import { karisikDenemePdf } from "@/lib/deneme/ornek-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Yerel doğrulama için karışık dersli örnek. Canlıda kapalıdır. */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ hata: "Yok." }, { status: 404 });
  }
  const buf = karisikDenemePdf();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=karisik-deneme.pdf",
    },
  });
}
