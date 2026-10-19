/**
 * SmartKoçluk oturumu — yalnızca TEST_MAKER_AUTH_REQUIRED=1 iken devreye girer.
 *
 * Bayrak kapalıyken mevcut açık çalışma alanı değişmez. Bayrak açıkken
 * yapılandırma eksikse kapı AÇILMAZ (503). Şifre toplanmaz, users.password_hash
 * okunmaz, anahtar istemciye yazılmaz.
 *
 * Gerekli ortam değişkenleri (yalnızca sunucu):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_JWT_SECRET
 */

import { NextResponse, type NextRequest } from "next/server";
import { erisimKarari, type ErisimKullanici } from "@/lib/foy-erisim";

export async function middleware(req: NextRequest) {
  if (process.env.TEST_MAKER_AUTH_REQUIRED !== "1") return NextResponse.next();

  const url = process.env.SUPABASE_URL?.trim();
  const servis = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const sir = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!url || !servis || !sir) {
    return new NextResponse(
      "Test Maker girişi yapılandırılmadı. Yetkisiz erişime izin verilmiyor.",
      { status: 503 }
    );
  }

  const token = tokenOku(req);
  if (!token) {
    return new NextResponse(
      "Bu çalışma alanı SmartKoçluk öğretmen oturumu ister. Geçerli oturum bulunamadı.",
      { status: 401 }
    );
  }

  const payload = await jwtDogrula(token, sir);
  const sub = typeof payload?.sub === "string" ? payload.sub : "";
  const email = typeof payload?.email === "string" ? payload.email : "";
  if (!payload || !sub) {
    return new NextResponse("Oturum doğrulanamadı.", { status: 401 });
  }

  const kullanici = await kullaniciOku(url, servis, sub, email);
  const karar = erisimKarari(kullanici);
  if (karar !== "izin") {
    const mesaj =
      karar === "pasif"
        ? "Hesap pasif. Test Maker oturumu açılamaz."
        : "Bu hesap Test Maker için yetkili değil.";
    return new NextResponse(mesaj, { status: 403 });
  }

  return NextResponse.next();
}

function tokenOku(req: NextRequest): string | null {
  const baslik = req.headers.get("authorization");
  if (baslik?.toLowerCase().startsWith("bearer ")) return baslik.slice(7).trim();
  const duz = req.cookies.get("ovip_access_token")?.value;
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

function b64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function jwtDogrula(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64url(s) as BufferSource,
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64url(p))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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
