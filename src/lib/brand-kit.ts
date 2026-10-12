/**
 * Kurumsal kimlik — koçluk platformundan okunur.
 *
 * Logo ve marka renkleri burada kopya tutulmaz; süper admin panelden
 * değiştirdiğinde yeni üretilen PDF'ler de değişsin diye merkezden çekilir.
 *
 * Uç nokta erişilemezse PDF üretimi durmaz: gömülü varsayılanlarla devam
 * eder, yalnızca logo çizilmez. Föy hazırlayan öğretmen ağ hatası yüzünden
 * çalışamaz duruma düşmemeli.
 */

export type BrandKit = {
  institutionName: string;
  logoDataUrl: string | null;
  colors: {
    lacivert: string;
    lacivertKoyu: string;
    kirmizi: string;
    maviAcik: string;
    gri: string;
  };
  slogan: string;
  /** true: merkezden okundu; false: varsayılanlar kullanıldı */
  fromApi: boolean;
};

const API_BASE =
  process.env.NEXT_PUBLIC_KOCLUK_API_BASE?.replace(/\/+$/, "") ||
  "https://www.dersonlinevipkocluk.com";

export const VARSAYILAN_MARKA: BrandKit = {
  institutionName: "ONLINE VIP DERSHANE",
  logoDataUrl: null,
  colors: {
    lacivert: "#173b70",
    lacivertKoyu: "#0f2a52",
    kirmizi: "#d72d42",
    maviAcik: "#eef4fa",
    gri: "#64748b",
  },
  slogan: "Olduğunuz yerden, olmak istediğiniz yere.",
  fromApi: false,
};

let onbellek: BrandKit | null = null;
let ucus: Promise<BrandKit> | null = null;

/** Logo 200 KB civarı; sekme ömrü boyunca bir kez indirilir. */
export async function loadBrandKit(zorla = false): Promise<BrandKit> {
  if (!zorla && onbellek) return onbellek;
  if (!zorla && ucus) return ucus;

  ucus = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public-brand-kit`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as {
        institution?: { name?: string };
        logo?: string | null;
        colors?: Partial<BrandKit["colors"]>;
        slogan?: string;
      };
      const kit: BrandKit = {
        institutionName: j.institution?.name?.trim() || VARSAYILAN_MARKA.institutionName,
        logoDataUrl: typeof j.logo === "string" && j.logo.startsWith("data:") ? j.logo : null,
        colors: { ...VARSAYILAN_MARKA.colors, ...(j.colors || {}) },
        slogan: j.slogan?.trim() || VARSAYILAN_MARKA.slogan,
        fromApi: true,
      };
      onbellek = kit;
      return kit;
    } catch {
      // Ağ/uç hatası PDF üretimini durdurmaz — logosuz devam edilir.
      onbellek = { ...VARSAYILAN_MARKA };
      return onbellek;
    } finally {
      ucus = null;
    }
  })();

  return ucus;
}

/** Senkron çizim yollarının kullanabilmesi için son okunan değer. */
export function cachedBrandKit(): BrandKit {
  return onbellek || VARSAYILAN_MARKA;
}

/**
 * jsPDF addImage'in beklediği biçim adı.
 * Data URL etiketi yanlış olabildiği için gövdeye bakılır (kayıtlı logo
 * "image/jpeg" etiketli bir PNG'dir).
 */
export function imageFormatOf(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const govde = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (govde.startsWith("iVBORw0KGgo")) return "PNG";
  if (govde.startsWith("/9j/")) return "JPEG";
  if (govde.startsWith("UklGR")) return "WEBP";
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}
