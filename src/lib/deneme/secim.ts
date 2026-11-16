/**
 * Havuzdan otomatik soru seçimi. Ortak metinli sorular birlikte gelir;
 * en az kullanılan sorular önce, eşitler arasında rastgele.
 */

export type SecimAday = { id: string; grupId: string | null; kullanim: number; dogru: string | null };

type Birim = { idler: string[]; kullanim: number; sans: number };

export function birimler(adaylar: SecimAday[], haric: Set<string>, rastgele: () => number): Birim[] {
  const gruplar = new Map<string, SecimAday[]>();
  const out: Birim[] = [];
  for (const a of adaylar) {
    if (a.grupId) {
      const g = gruplar.get(a.grupId) ?? [];
      g.push(a);
      gruplar.set(a.grupId, g);
    } else if (!haric.has(a.id)) {
      out.push({ idler: [a.id], kullanim: a.kullanim, sans: rastgele() });
    }
  }
  for (const uyeler of gruplar.values()) {
    if (uyeler.some((u) => haric.has(u.id))) continue;
    out.push({
      idler: uyeler.map((u) => u.id),
      kullanim: Math.max(...uyeler.map((u) => u.kullanim)),
      sans: rastgele(),
    });
  }
  return out;
}

/**
 * Mevcut seçimi `gereken` sayıya tamamlar. Cevabı olan sorular önce gelir,
 * çünkü cevapsız soru online sınavda puanlanamaz.
 */
export function otomatikTamamla(
  adaylar: SecimAday[],
  gereken: number,
  mevcut: string[],
  haric: Set<string> = new Set(),
  rastgele: () => number = Math.random
): string[] {
  const secili = new Set(mevcut);
  const liste = [...mevcut];
  const cevap = new Map(adaylar.map((a) => [a.id, a.dogru]));
  const adayBirim = birimler(adaylar, new Set([...haric, ...secili]), rastgele).sort((a, b) => {
    const ca = a.idler.every((id) => cevap.get(id)) ? 0 : 1;
    const cb = b.idler.every((id) => cevap.get(id)) ? 0 : 1;
    return ca - cb || a.kullanim - b.kullanim || a.sans - b.sans;
  });
  for (const b of adayBirim) {
    const kalan = gereken - liste.length;
    if (kalan <= 0) break;
    if (b.idler.length > kalan) continue;
    for (const id of b.idler) {
      secili.add(id);
      liste.push(id);
    }
  }
  return liste;
}

/** Bir soruyu (grubuyla birlikte) ekler ya da çıkarır. */
export function secimDegistir(
  mevcut: string[],
  soru: { id: string; grupId: string | null },
  grupUyeleri: string[]
): string[] {
  const idler = soru.grupId ? grupUyeleri : [soru.id];
  if (mevcut.includes(soru.id)) return mevcut.filter((id) => !idler.includes(id));
  return [...mevcut, ...idler.filter((id) => !mevcut.includes(id))];
}
