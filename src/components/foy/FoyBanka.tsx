"use client";

import { useEffect, useState } from "react";
import type { DocBlock } from "@/lib/pdf-blocks";
import { blokEtiketi } from "@/lib/foy-icerik";
import { foyBankaListele, foyBankaSil, type FoyBankaKaydi } from "@/lib/storage";

export function FoyBanka({
  yenileme,
  onEkle,
}: {
  yenileme: number;
  onEkle: (blok: DocBlock) => void;
}) {
  const [liste, setListe] = useState<FoyBankaKaydi[]>([]);
  const [arama, setArama] = useState("");
  const [ders, setDers] = useState("");
  const [sinif, setSinif] = useState("");

  useEffect(() => {
    void foyBankaListele().then(setListe).catch(() => setListe([]));
  }, [yenileme]);

  const sorgu = arama.toLocaleLowerCase("tr-TR");
  const goren = liste.filter((k) => {
    if (ders && k.ders !== ders) return false;
    if (sinif && k.sinif !== sinif) return false;
    if (!sorgu) return true;
    const etiket = blokEtiketi(k.blok as DocBlock).toLocaleLowerCase("tr-TR");
    return (
      etiket.includes(sorgu) ||
      k.konu.toLocaleLowerCase("tr-TR").includes(sorgu) ||
      k.tip.toLocaleLowerCase("tr-TR").includes(sorgu) ||
      k.zorluk.toLocaleLowerCase("tr-TR").includes(sorgu)
    );
  });
  const dersler = [...new Set(liste.map((k) => k.ders).filter(Boolean))];

  return (
    <div className="space-y-2 text-xs">
      <input
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Konu, tür veya metin ara"
        className="w-full rounded border border-slate-300 px-2 py-1"
      />
      <div className="grid grid-cols-2 gap-1">
        <select value={ders} onChange={(e) => setDers(e.target.value)} className="rounded border px-1 py-1">
          <option value="">Tüm dersler</option>
          {dersler.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={sinif} onChange={(e) => setSinif(e.target.value)} className="rounded border px-1 py-1">
          <option value="">Tüm sınıflar</option>
          {["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((n) => (
            <option key={n} value={n}>
              {n}. sınıf
            </option>
          ))}
        </select>
      </div>
      {goren.length === 0 ? (
        <p className="text-slate-500">Kayıtlı soru yok. Ortadaki bir bloğu seçip bankaya kaydedebilirsiniz.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {goren.map((k) => (
            <li key={k.id} className="rounded border bg-white p-2">
              <p className="truncate">{blokEtiketi(k.blok as DocBlock)}</p>
              <p className="text-[11px] text-slate-500">
                {[k.ders, k.sinif && `${k.sinif}. sınıf`, k.konu, k.zorluk, k.tip].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1 flex gap-2">
                <button type="button" className="font-semibold text-dershanem-navy" onClick={() => onEkle(k.blok as DocBlock)}>
                  Föye ekle
                </button>
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => {
                    void foyBankaSil(k.id).then(() => setListe((p) => p.filter((x) => x.id !== k.id)));
                  }}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
