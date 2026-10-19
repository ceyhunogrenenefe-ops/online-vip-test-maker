import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { erisimKarari } from "@/lib/foy-erisim";
import { girisZorunlu, OTURUM_CEREZ, oturumdenKullanici, oturumDogrula, oturumSirleri } from "@/lib/oturum";

export async function GET() {
  if (!girisZorunlu()) return NextResponse.json({ gerekli: false, kullanici: null });
  const token = (await cookies()).get(OTURUM_CEREZ)?.value;
  if (!token) return NextResponse.json({ gerekli: true, kullanici: null });
  const payload = await oturumDogrula(token, oturumSirleri());
  const kullanici = oturumdenKullanici(payload);
  if (!payload || !kullanici || erisimKarari(kullanici) !== "izin") {
    return NextResponse.json({ gerekli: true, kullanici: null });
  }
  return NextResponse.json({
    gerekli: true,
    kullanici: {
      ad: typeof payload.ad === "string" ? payload.ad : "",
      email: typeof payload.email === "string" ? payload.email : "",
    },
  });
}
