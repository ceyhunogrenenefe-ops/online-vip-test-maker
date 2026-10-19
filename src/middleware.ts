/**
 * Smart VIP Koçluk öğretmen kapısı — yalnızca TEST_MAKER_AUTH_REQUIRED=1 iken.
 *
 * Bayrak kapalıyken çalışma alanı açık kalır. Bayrak açıkken oturum sırrı
 * yoksa kapı açılmaz (503). Şifre bu uygulamada tutulmaz.
 * Öğrenci sınav linki (/exam) kapının dışındadır.
 */

import { NextResponse, type NextRequest } from "next/server";
import { erisimKarari, type ErisimKullanici } from "@/lib/foy-erisim";
import {
  girisZorunlu,
  herkeseAcikYol,
  OTURUM_CEREZ,
  oturumdenKullanici,
  oturumDogrula,
  oturumSirleri,
} from "@/lib/oturum";

export async function middleware(req: NextRequest) {
  if (!girisZorunlu()) return NextResponse.next();
  if (herkeseAcikYol(req.nextUrl.pathname)) return NextResponse.next();

  const sirler = oturumSirleri();
  if (!sirler.length) {
    return new NextResponse(
      "Test Maker girişi yapılandırılmadı. Yetkisiz erişime izin verilmiyor.",
      { status: 503 }
    );
  }

  const token = tokenOku(req);
  if (!token) return reddet(req, 401, "Smart VIP Koçluk öğretmen girişi gerekli.");

  const payload = await oturumDogrula(token, sirler);
  const sub = typeof payload?.sub === "string" ? payload.sub : "";
  const email = typeof payload?.email === "string" ? payload.email : "";
  if (!payload || !sub) return reddet(req, 401, "Oturum doğrulanamadı.");

  const url = process.env.SUPABASE_URL?.trim();
  const servis = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let kullanici = oturumdenKullanici(payload);
  if (url && servis) {
    const satir = await kullaniciOku(url, servis, sub, email);
    if (!satir) return reddet(req, 403, "Bu hesap Test Maker için yetkili değil.");
    kullanici = satir;
  }

  const karar = erisimKarari(kullanici);
  if (karar !== "izin") {
    const mesaj =
      karar === "pasif"
        ? "Hesap pasif. Test Maker oturumu açılamaz."
        : "Bu hesap öğretmen olarak kayıtlı değil.";
    return reddet(req, 403, mesaj);
  }

  return NextResponse.next();
}

function reddet(req: NextRequest, durum: number, mesaj: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ hata: mesaj }, { status: durum });
  }
  const giris = new URL("/giris", req.url);
  return NextResponse.redirect(giris);
}

function tokenOku(req: NextRequest): string | null {
  const baslik = req.headers.get("authorization");
  if (baslik?.toLowerCase().startsWith("bearer ")) return baslik.slice(7).trim();
  const duz = req.cookies.get(OTURUM_CEREZ)?.value;
  if (duz) return duz;
  for (const c of req.cookies.getAll()) {
    if (!c.name.startsWith("sb-") || !c.name.endsWith("-auth-token")) continue;
    try {
      const ham = c.value.startsWith("base64-") ? atob(c.value.slice(7)) : c.value;
      const j = JSON.parse(ham) as { access_token?: string };
      if (j.access_token) return j.access_token;
    } catch {
      /* başka çerez biçimi */
    }
  }
  return null;
}

async function kullaniciOku(
  url: string,
  servis: string,
  sub: string,
  email: string
): Promise<ErisimKullanici | null> {
  const u = url.replace(/\/+$/, "");
  const baslik = {
    apikey: servis,
    Authorization: `Bearer ${servis}`,
    Accept: "application/json",
  };
  const idIle = await satirGetir(u, baslik, `id=eq.${encodeURIComponent(sub)}`);
  if (idIle) return idIle;
  if (!email) return null;
  return satirGetir(u, baslik, `email=eq.${encodeURIComponent(email)}`);
}

async function satirGetir(
  url: string,
  baslik: Record<string, string>,
  filtre: string
): Promise<ErisimKullanici | null> {
  try {
    const r = await fetch(`${url}/rest/v1/users?${filtre}&select=role,roles,is_active&limit=1`, {
      headers: baslik,
      cache: "no-store",
    });
    if (!r.ok) return null;
    const liste = (await r.json()) as ErisimKullanici[];
    return liste[0] ?? null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
