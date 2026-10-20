"use client";

import { useEffect, useMemo } from "react";
import { MEB_YIL, mebKazanimlari } from "@/lib/meb-kazanim";

/**
 * Föye soru girilmeden önce seçilir. Seçilen metin sorunun üstünde basılır.
 */
export function FoyKazanimSec({
  sinif,
  brans,
  value,
  onChange,
}: {
  sinif: string | number;
  brans: string;
  value: string;
  onChange: (kazanim: string) => void;
}) {
  const kazanimlar = useMemo(() => mebKazanimlari(sinif, brans), [sinif, brans]);
  const secili = kazanimlar.find((s) => s.kazanim === value) || null;

  useEffect(() => {
    if (value && kazanimlar.length && !kazanimlar.some((s) => s.kazanim === value)) onChange("");
  }, [value, kazanimlar, onChange]);

  const alan = "mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2" data-test="foy-kazanim-kutu">
      <label className="block text-xs font-semibold text-amber-950">
        Kazanım — sorudan önce
        <span className="mt-0.5 block font-normal text-amber-900">
          Öğrenci bu yazıyı sorunun üstünde görür. Soru yapıştırılsa da kazanım kaybolmaz.
        </span>
        {kazanimlar.length ? (
          <select
            value={kazanimlar.some((s) => s.kazanim === value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className={alan}
            data-test="foy-kazanim"
          >
            <option value="">Önce kazanımı seçin</option>
            {kazanimlar.map((s) => (
              <option key={`${s.kod}-${s.kazanim}`} value={s.kazanim}>
                {(s.kod || s.unite || "Kazanım") +
                  " — " +
                  s.kazanim.replace(/^[A-ZÇĞİÖŞÜ0-9.]+\s*/, "").slice(0, 90)}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Bu sınıf ve ders için resmî tablo yok. Kazanımı buraya yazın."
            className={alan}
            data-test="foy-kazanim"
          />
        )}
      </label>
      {secili ? (
        <p className="mt-1 text-[11px] text-amber-900">
          {[secili.unite, secili.konu].filter(Boolean).join(" / ")}
          {` · ODSGM ${MEB_YIL}`}
        </p>
      ) : kazanimlar.length ? (
        <p className="mt-1 text-[11px] text-amber-800">Liste ODSGM {MEB_YIL} 1. dönem tablosundan gelir.</p>
      ) : null}
    </div>
  );
}
