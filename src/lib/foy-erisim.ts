/**
 * SmartKoçluk → Test Maker erişim kararı.
 *
 * SmartKoçluk bugün üçüncü parti bir uygulamaya OAuth2 / OpenID Connect
 * oturumu vermiyor. Öğretmen girişi `users` tablosundaki rolle yapılıyor.
 * Bu fonksiyon yalnızca sunucu, kullanıcı satırını kendi sorgusuyla
 * okuduktan sonra çağrılır. İstemciden gelen role alanı tek başına
 * yeterli değildir; middleware JWT doğrulayıp satırı servis anahtarıyla okur.
 *
 * Bayrak kapalıyken (TEST_MAKER_AUTH_REQUIRED !== "1") bu karar
 * uygulanmaz. Yarım bir giriş ekranı yayına alınmaz.
 */

export const TEST_MAKER_ROLLERI = ["super_admin", "admin", "teacher"] as const;

export type ErisimKarari = "izin" | "pasif" | "yetkisiz" | "yok";

export type ErisimKullanici = {
  role?: string | null;
  roles?: string[] | null;
  is_active?: boolean | null;
};

export function erisimKarari(kullanici: ErisimKullanici | null | undefined): ErisimKarari {
  if (!kullanici) return "yok";
  if (kullanici.is_active === false) return "pasif";
  const roller = [kullanici.role, ...(kullanici.roles ?? [])].filter(
    (r): r is string => typeof r === "string" && r.length > 0
  );
  if (roller.some((r) => (TEST_MAKER_ROLLERI as readonly string[]).includes(r))) return "izin";
  return "yetkisiz";
}
