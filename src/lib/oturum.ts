/**
 * Test Maker oturumu. Şifre ve Koçluk parolası burada durmaz.
 * Çerez, Koçluk öğretmeni doğruladıktan sonra sunucunun imzaladığı JWT'dir.
 */

import type { ErisimKullanici } from "./foy-erisim";

export const OTURUM_CEREZ = "ovip_access_token";
export const OTURUM_SURE_SANIYE = 60 * 60 * 12;

export type OturumYuk = {
  sub: string;
  email: string;
  ad?: string;
  role?: string;
  roles?: string[];
};

export function girisZorunlu(): boolean {
  return process.env.TEST_MAKER_AUTH_REQUIRED === "1";
}

export function oturumSirleri(): string[] {
  const aday = [
    process.env.TEST_MAKER_SESSION_SECRET,
    process.env.SUPABASE_JWT_SECRET,
    process.env.KOCLUK_JWT_SECRET,
    process.env.APP_JWT_SECRET,
  ];
  const tek = new Set<string>();
  for (const s of aday) {
    const t = s?.trim();
    if (t) tek.add(t);
  }
  return [...tek];
}

export function koclukGirisAdresi(): string {
  const ozel = process.env.KOCLUK_AUTH_URL?.trim();
  if (ozel) return ozel;
  const kok = (process.env.NEXT_PUBLIC_KOCLUK_API_BASE || "https://www.dersonlinevipkocluk.com").replace(
    /\/+$/,
    ""
  );
  return `${kok}/api/auth-login`;
}

/** Öğrenci sınav linki ve girişin kendisi kapının dışında kalır. */
export function herkeseAcikYol(pathname: string): boolean {
  if (pathname === "/giris" || pathname.startsWith("/giris/")) return true;
  if (pathname === "/exam" || pathname.startsWith("/exam/")) return true;
  if (pathname === "/api/giris" || pathname === "/api/cikis") return true;
  return false;
}

export function oturumdenKullanici(payload: Record<string, unknown> | null): ErisimKullanici | null {
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((r): r is string => typeof r === "string")
    : null;
  return {
    role: typeof payload.role === "string" ? payload.role : null,
    roles,
    is_active: true,
  };
}

function b64urlYaz(bayt: Uint8Array): string {
  let ikili = "";
  for (const b of bayt) ikili += String.fromCharCode(b);
  return btoa(ikili).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlOku(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function oturumImzala(yuk: OturumYuk, secret: string, simdi = Date.now()): Promise<string> {
  const baslik = b64urlYaz(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const govde = b64urlYaz(
    new TextEncoder().encode(
      JSON.stringify({
        ...yuk,
        iat: Math.floor(simdi / 1000),
        exp: Math.floor(simdi / 1000) + OTURUM_SURE_SANIYE,
      })
    )
  );
  const imzasiz = `${baslik}.${govde}`;
  const anahtar = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const imza = new Uint8Array(await crypto.subtle.sign("HMAC", anahtar, new TextEncoder().encode(imzasiz)));
  return `${imzasiz}.${b64urlYaz(imza)}`;
}

export async function oturumDogrula(
  token: string,
  secrets: string[]
): Promise<Record<string, unknown> | null> {
  for (const secret of secrets) {
    const payload = await tekDogrula(token, secret);
    if (payload) return payload;
  }
  return null;
}

async function tekDogrula(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  try {
    const anahtar = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      anahtar,
      b64urlOku(s) as BufferSource,
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlOku(p))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
