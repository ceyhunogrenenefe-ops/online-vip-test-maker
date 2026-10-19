/**
 * Smart VIP Koçluk → Test Maker erişim kararı.
 *
 * Giriş şifresi bu uygulamada tutulmaz. Koçluk `/api/auth-login` öğretmeni
 * doğrular; bu fonksiyon yalnızca sunucunun imzaladığı oturumdaki veya
 * veritabanından okunan rolü kabul eder. İstemciden gelen rol tek başına
 * yetmez.
 *
 * Bayrak kapalıyken (TEST_MAKER_AUTH_REQUIRED !== "1") kapı uygulanmaz.
 */

export const TEST_MAKER_ROLLERI = ["super_admin", "admin", "teacher"] as const;

export type ErisimKarari = "izin" | "pasif" | "yetkisiz" | "yok";

export type ErisimKullanici = {
  role?: string | null;
  roles?: string[] | null;
  is_active?: boolean | null;
};

/** Koçluk giriş yanıtındaki hesap, Test Maker'a girebilir mi. */
export function koclukHesapKarari(hesap: {
  role?: string | null;
  roles?: string[] | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
} | null | undefined): ErisimKarari {
  if (!hesap) return "yok";
  const aktif = hesap.isActive !== false && hesap.is_active !== false;
  return erisimKarari({
    role: hesap.role,
    roles: hesap.roles,
    is_active: aktif,
  });
}

export function koclukYanitKarari(yanit: unknown): {
  karar: ErisimKarari;
  yuk: { sub: string; email: string; ad?: string; role?: string; roles?: string[] } | null;
} {
  const govde = yanit && typeof yanit === "object" ? (yanit as { user?: unknown }) : null;
  const user = govde?.user && typeof govde.user === "object" ? (govde.user as Record<string, unknown>) : null;
  const karar = koclukHesapKarari(
    user
      ? {
          role: typeof user.role === "string" ? user.role : null,
          roles: Array.isArray(user.roles) ? user.roles.filter((r): r is string => typeof r === "string") : null,
          isActive: typeof user.isActive === "boolean" ? user.isActive : null,
          is_active: typeof user.is_active === "boolean" ? user.is_active : null,
        }
      : null
  );
  if (karar !== "izin" || !user) return { karar, yuk: null };
  const sub = typeof user.id === "string" ? user.id : "";
  const email = typeof user.email === "string" ? user.email : "";
  if (!sub || !email) return { karar: "yok", yuk: null };
  return {
    karar,
    yuk: {
      sub,
      email,
      ad: typeof user.name === "string" ? user.name : undefined,
      role: typeof user.role === "string" ? user.role : undefined,
      roles: Array.isArray(user.roles) ? user.roles.filter((r): r is string => typeof r === "string") : undefined,
    },
  };
}

export function erisimKarari(kullanici: ErisimKullanici | null | undefined): ErisimKarari {
  if (!kullanici) return "yok";
  if (kullanici.is_active === false) return "pasif";
  const roller = [kullanici.role, ...(kullanici.roles ?? [])].filter(
    (r): r is string => typeof r === "string" && r.length > 0
  );
  if (roller.some((r) => (TEST_MAKER_ROLLERI as readonly string[]).includes(r))) return "izin";
  return "yetkisiz";
}
