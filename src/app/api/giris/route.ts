import { NextResponse } from "next/server";
import { koclukYanitKarari } from "@/lib/foy-erisim";
import { koclukGirisAdresi, OTURUM_CEREZ, OTURUM_SURE_SANIYE, oturumImzala, oturumSirleri } from "@/lib/oturum";

/**
 * Şifre Koçluk girişine iletilir ve burada saklanmaz.
 * Öğretmen, koç, yönetici ve süper yönetici çerez alır.
 */
export async function POST(req: Request) {
  let govde: { email?: unknown; password?: unknown };
  try {
    govde = (await req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ hata: "E-posta ve şifre gerekli." }, { status: 400 });
  }
  const email = typeof govde.email === "string" ? govde.email.trim() : "";
  const password = typeof govde.password === "string" ? govde.password : "";
  if (!email || !password) {
    return NextResponse.json({ hata: "E-posta ve şifre gerekli." }, { status: 400 });
  }

  const sir = oturumSirleri()[0];
  if (!sir) {
    return NextResponse.json({ hata: "Giriş sunucuda henüz yapılandırılmadı." }, { status: 503 });
  }

  let yanit: Response;
  try {
    yanit = await fetch(koclukGirisAdresi(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return NextResponse.json({ hata: "Smart VIP Koçluk girişi şu an yanıt vermiyor." }, { status: 503 });
  }

  const json = await yanit.json().catch(() => null);
  if (yanit.status === 401) {
    return NextResponse.json({ hata: "E-posta veya şifre hatalı." }, { status: 401 });
  }
  if (yanit.status === 403) {
    const kod =
      json && typeof json === "object" && "error" in json ? String((json as { error?: string }).error) : "";
    const mesaj =
      kod === "inactive_user"
        ? "Hesap pasif. Test Maker açılamaz."
        : kod === "pending_approval"
          ? "Hesap henüz onaylanmamış."
          : "Bu hesapla giriş açılamadı.";
    return NextResponse.json({ hata: mesaj }, { status: 403 });
  }
  if (!yanit.ok) {
    return NextResponse.json({ hata: "Smart VIP Koçluk girişi şu an yanıt vermiyor." }, { status: 503 });
  }

  const sonuc = koclukYanitKarari(json);
  if (sonuc.karar !== "izin" || !sonuc.yuk) {
    const mesaj =
      sonuc.karar === "pasif"
        ? "Hesap pasif. Test Maker açılamaz."
        : "Bu hesap Smart VIP Koçlukta öğretmen veya koç olarak kayıtlı değil.";
    return NextResponse.json({ hata: mesaj }, { status: 403 });
  }

  const token = await oturumImzala(sonuc.yuk, sir);
  const res = NextResponse.json({ tamam: true, ad: sonuc.yuk.ad || sonuc.yuk.email });
  res.cookies.set(OTURUM_CEREZ, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OTURUM_SURE_SANIYE,
  });
  return res;
}
