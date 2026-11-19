"use client";

import { useEffect, useState } from "react";
import type { DocBlock } from "@/lib/pdf-blocks";
import { foyBankaSil } from "@/lib/storage";
import { havuzBankaGetir, havuzListele, type HavuzBanka, type HavuzListe } from "@/lib/havuz/istemci";

/** Föy bankası: bütün öğretmenlerin kaydettiği bloklar (ortak havuz). */
export function FoyBanka({
  yenileme,
  onEkle,
}: {
  yenileme: number;
  onEkle: (blok: DocBlock) => void;
}) {
  const [liste, setListe] = useState<HavuzBanka[]>([]);
  const [ben, setBen] = useState<HavuzListe["ben"] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [ders, setDers] = useState("");
  const [sinif, setSinif] = useState("");
  const [ekleyen, setEkleyen] = useState("");

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    void havuzListele()
      .then((j) => {
        if (iptal) return;
        setListe(j.banka);
        setBen(j.ben);
        setHata(null);
      })
      .catch((e: Error) => !iptal && setHata(e.message))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, [yenileme]);

  const sorgu = arama.toLocaleLowerCase("tr-TR");
  const goren = liste.filter((k) => {
    if (ders && k.ders !== ders) return false;
    if (sinif && k.sinif !== sinif) return false;
    if (ekleyen && k.ekleyen.id !== ekleyen) return false;
    if (!sorgu) return true;
    return [k.etiket, k.konu, k.tip, k.zorluk, k.ekleyen.ad].some((m) =>
      m.toLocaleLowerCase("tr-TR").includes(sorgu)
    );
  });
  const dersler = [...new Set(liste.map((k) => k.ders).filter(Boolean))];
  const ekleyenler = [...new Map(liste.map((k) => [k.ekleyen.id, k.ekleyen.ad])).entries()];

  const ekle = async (k: HavuzBanka) => {
    setMesgul(k.id);
    try {
      const tam = await havuzBankaGetir(k.id);
      onEkle(tam.blok as DocBlock);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Eklenemedi.");
    } finally {
      setMesgul(null);
    }
  };

  const sil = async (k: HavuzBanka) => {
    if (!confirm("Bu kayıt ortak havuzdan herkes için silinecek. Emin misiniz?")) return;
    setMesgul(k.id);
    try {
      await foyBankaSil(k.id);
      setListe((p) => p.filter((x) => x.id !== k.id));
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setMesgul(null);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] text-slate-500">Ortak havuz: bütün öğretmenlerin kaydettiği sorular.</p>
      <input
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Konu, tür, metin veya öğretmen ara"
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
        <select
          value={ekleyen}
          onChange={(e) => setEkleyen(e.target.value)}
          className="col-span-2 rounded border px-1 py-1"
        >
          <option value="">Tüm öğretmenler</option>
          {ekleyenler.map(([id, ad]) => (
            <option key={id} value={id}>
              {ad}
            </option>
          ))}
        </select>
      </div>
      {hata ? <p className="text-amber-800">{hata}</p> : null}
      {yukleniyor ? (
        <p className="text-slate-500">Havuz yükleniyor…</p>
      ) : goren.length === 0 ? (
        <p className="text-slate-500">Kayıtlı soru yok. Ortadaki bir bloğu seçip bankaya kaydedebilirsiniz.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {goren.map((k) => (
            <li key={k.id} className="rounded border bg-white p-2">
              <p className="truncate">{k.etiket || k.tip}</p>
              <p className="text-[11px] text-slate-500">
                {[k.ders, k.sinif && `${k.sinif}. sınıf`, k.konu, k.zorluk, k.ekleyen.ad].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  disabled={mesgul === k.id}
                  className="font-semibold text-dershanem-navy disabled:opacity-50"
                  onClick={() => void ekle(k)}
                >
                  Föye ekle
                </button>
                {ben && (ben.yonetici || ben.id === k.ekleyen.id) ? (
                  <button
                    type="button"
                    disabled={mesgul === k.id}
                    className="text-red-600 disabled:opacity-50"
                    onClick={() => void sil(k)}
                  >
                    Sil
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
