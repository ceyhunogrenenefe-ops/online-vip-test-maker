"use client";

import { useCallback, useEffect, useState } from "react";
import { DenemeKur } from "@/components/deneme/DenemeKur";
import { PdfHavuzu } from "@/components/deneme/PdfHavuzu";
import { YayinSonuclari } from "@/components/deneme/YayinSonuclari";
import {
  denemeleriOku,
  gruplariOku,
  pdfleriOku,
  sorulariOku,
  type DenemeTaslak,
  type HavuzGrup,
  type HavuzPdf,
  type HavuzSoru,
} from "@/lib/deneme/havuz";

export type HavuzVeri = {
  pdfler: HavuzPdf[];
  sorular: HavuzSoru[];
  gruplar: HavuzGrup[];
  denemeler: DenemeTaslak[];
};

const SEKMELER = [
  { id: "havuz", ad: "1. PDF yükle ve soruları kes" },
  { id: "kur", ad: "2. Deneme oluştur" },
  { id: "yayin", ad: "3. Online sonuçlar" },
] as const;

export function DenemeStudyo() {
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]["id"]>("havuz");
  const [veri, setVeri] = useState<HavuzVeri>({ pdfler: [], sorular: [], gruplar: [], denemeler: [] });
  const [hazir, setHazir] = useState(false);

  const yenile = useCallback(async () => {
    const [pdfler, sorular, gruplar, denemeler] = await Promise.all([
      pdfleriOku(),
      sorulariOku(),
      gruplariOku(),
      denemeleriOku(),
    ]);
    setVeri({ pdfler, sorular, gruplar, denemeler });
    setHazir(true);
  }, []);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b bg-white px-3 pt-2">
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSekme(s.id)}
            className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold ${
              sekme === s.id ? "bg-dershanem-navy text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {s.ad}
          </button>
        ))}
        <span className="ml-auto self-center whitespace-nowrap px-2 text-xs text-slate-500">
          Havuz: {veri.pdfler.length} PDF · {veri.sorular.length} soru
        </span>
      </nav>
      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        {!hazir ? (
          <p className="text-sm text-slate-500">Havuz açılıyor…</p>
        ) : sekme === "havuz" ? (
          <PdfHavuzu veri={veri} yenile={yenile} />
        ) : sekme === "kur" ? (
          <DenemeKur veri={veri} yenile={yenile} />
        ) : (
          <YayinSonuclari />
        )}
      </div>
    </div>
  );
}
