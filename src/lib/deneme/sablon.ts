import type { Bolum } from "./model";

function id(): string {
  return crypto.randomUUID();
}

/** LGS sözel / sayısal dağılımı. Sayılar, dersler ve sıra yönetici ekranında değişir. */
export function lgsBolumleri(): Bolum[] {
  return [
    {
      id: id(),
      ad: "Sözel",
      sureDakika: 75,
      dersler: [
        { ders: "Türkçe", adet: 20 },
        { ders: "T.C. İnkılap Tarihi ve Atatürkçülük", adet: 10 },
        { ders: "Din Kültürü ve Ahlak Bilgisi", adet: 10 },
        { ders: "İngilizce", adet: 10 },
      ],
    },
    {
      id: id(),
      ad: "Sayısal",
      sureDakika: 80,
      dersler: [
        { ders: "Matematik", adet: 20 },
        { ders: "Fen Bilimleri", adet: 20 },
      ],
    },
  ];
}
