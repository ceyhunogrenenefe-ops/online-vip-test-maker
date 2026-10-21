"use client";

import { useEffect, useMemo } from "react";
import {
  MEB_YIL,
  mebKazanimlari,
  yaziliGrupAdi,
  yaziliGrupSirasi,
  yaziliKisaEtiket,
} from "@/lib/meb-kazanim";

/**
 * Föye soru girilmeden önce seçilir. Seçilen metin sorunun üstünde basılır.
 */
export function FoyKazanimSec({
  sinif,
  brans,
  value,
  onChange,
  yazili,
  sade = false,
}: {
  sinif: string | number;
  brans: string;
  value: string;
  onChange: (kazanim: string) => void;
  /** Föy künyesindeki yazılı. Eşleşen grup listenin başında durur. */
  yazili?: string;
  /** Soru kartında kısa seçim. Yine yüklü listeden gelir. */
  sade?: boolean;
}) {
  const kazanimlar = useMemo(() => mebKazanimlari(sinif, brans), [sinif, brans]);
  const secili = kazanimlar.find((s) => s.kazanim === value) || null;
  const gruplar = useMemo(() => {
    const map = new Map<string, typeof kazanimlar>();
    for (const s of kazanimlar) {
      const ad = yaziliGrupAdi(s);
      const liste = map.get(ad) || [];
      liste.push(s);
      map.set(ad, liste);
    }
    return yaziliGrupSirasi(yazili)
      .filter((ad) => map.has(ad))
      .map((ad) => [ad, map.get(ad)!] as const);
  }, [kazanimlar, yazili]);

  useEffect(() => {
    if (value && kazanimlar.length && !kazanimlar.some((s) => s.kazanim === value)) onChange("");
  }, [value, kazanimlar, onChange]);

  const alan = "mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2" data-test="foy-kazanim-kutu">
      <label className="block text-xs font-semibold text-amber-950">
        {sade ? "Kazanım" : "Kazanım — sorudan önce"}
        {sade ? null : (
          <span className="mt-0.5 block font-normal text-amber-900">
            Yüklü tablodan seçin. Kazanımlar 1. yazılı ve 2. yazılı olarak ayrılır. Öğrenci bu kazanımı sorunun üstünde görür.
          </span>
        )}
        {kazanimlar.length ? (
          <select
            value={kazanimlar.some((s) => s.kazanim === value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className={alan}
            data-test="foy-kazanim"
          >
            <option value="">Tablodan kazanım seçin</option>
            {gruplar.map(([unite, satirlar]) => (
              <optgroup key={unite} label={unite}>
                {satirlar.map((s) => (
                  <option key={`${s.kod}-${s.kazanim}`} value={s.kazanim}>
                    {yaziliKisaEtiket(s) +
                      " — " +
                      (s.kod || "Kazanım") +
                      " — " +
                      s.kazanim.replace(/^[A-ZÇĞİÖŞÜ0-9.]+\s*/, "").slice(0, 90)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <p className="mt-1 font-normal text-amber-900" data-test="foy-kazanim-yok">
            Bu sınıf ve ders için yüklü kazanım tablosu yok.
          </p>
        )}
      </label>
      {secili ? (
        <p className="mt-1 text-[11px] text-amber-900">
          {[secili.unite, secili.konu].filter(Boolean).join(" / ")}
          {` · ${yaziliKisaEtiket(secili)} · ODSGM ${MEB_YIL}`}
        </p>
      ) : kazanimlar.length ? (
        <p className="mt-1 text-[11px] text-amber-800">
          Liste ODSGM {MEB_YIL} tablosundan gelir. Her kazanım 1. yazılı, 2. yazılı ya da ikisi olarak işaretlidir.
        </p>
      ) : null}
    </div>
  );
}
