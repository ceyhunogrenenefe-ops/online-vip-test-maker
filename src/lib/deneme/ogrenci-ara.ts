import type { KurumOgrenci } from "./telefon";

export async function ogrenciAra(soyad: string): Promise<{ kayitlar: KurumOgrenci[]; kayitVar: boolean }> {
  const gomulu = process.env.DENEME_OGRENCI_JSON?.trim();
  if (gomulu) {
    const liste = JSON.parse(gomulu) as KurumOgrenci[];
    return { kayitlar: Array.isArray(liste) ? liste : [], kayitVar: true };
  }
  const url = process.env.SUPABASE_URL?.trim();
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anahtar) return { kayitlar: [], kayitVar: false };

  const parca = soyad.replace(/[%*,]/g, "").trim();
  if (!parca) return { kayitlar: [], kayitVar: true };
  const u = `${url.replace(/\/+$/, "")}/rest/v1/students?select=id,name,phone,parent_phone&deleted_at=is.null&name=ilike.*${encodeURIComponent(parca)}*&limit=30`;
  let yanit: Response;
  try {
    yanit = await fetch(u, {
      headers: { apikey: anahtar, Authorization: `Bearer ${anahtar}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("Öğrenci kayıtları şu an okunamadı.");
  }
  if (!yanit.ok) throw new Error("Öğrenci kayıtları şu an okunamadı.");
  const liste = (await yanit.json()) as {
    id?: string;
    name?: string;
    phone?: string | null;
    parent_phone?: string | null;
  }[];
  return {
    kayitVar: true,
    kayitlar: (liste || [])
      .filter((s) => s.id && s.name)
      .map((s) => ({
        id: String(s.id),
        ad: String(s.name),
        telefon: s.phone ?? null,
        veliTelefon: s.parent_phone ?? null,
      })),
  };
}
