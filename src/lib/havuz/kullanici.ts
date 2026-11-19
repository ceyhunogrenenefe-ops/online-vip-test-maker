import { cookies } from "next/headers";
import { girisZorunlu, OTURUM_CEREZ, oturumDogrula, oturumSirleri } from "@/lib/oturum";
import { HavuzHatasi } from "./depo.ts";
import type { Kullanici } from "./islem.ts";

const YONETICI = new Set(["super_admin", "admin"]);

/** İsteği yapan öğretmen. Giriş kapalıyken (yerel geliştirme) tek bir yerel kullanıcı. */
export async function havuzKullanicisi(): Promise<Kullanici> {
  if (!girisZorunlu()) return { id: "yerel", ad: "Yerel kullanıcı", yonetici: true };
  const token = (await cookies()).get(OTURUM_CEREZ)?.value;
  const p = token ? await oturumDogrula(token, oturumSirleri()) : null;
  const id = typeof p?.sub === "string" ? p.sub : "";
  if (!p || !id) throw new HavuzHatasi("Oturum doğrulanamadı.", 401);
  const roller = [p.role, ...(Array.isArray(p.roles) ? p.roles : [])].filter(
    (r): r is string => typeof r === "string"
  );
  const ad =
    (typeof p.ad === "string" && p.ad.trim()) ||
    (typeof p.email === "string" && p.email.split("@")[0]) ||
    "Öğretmen";
  return { id, ad, yonetici: roller.some((r) => YONETICI.has(r)) };
}
