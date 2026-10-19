"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Maximize2, Printer } from "lucide-react";

export function FoyOnizleme({
  url,
  sayfa,
  uretiliyor,
  hata,
  onIndirOgrenci,
  onIndirOgretmen,
}: {
  url: string | null;
  sayfa: number;
  uretiliyor: boolean;
  hata: string | null;
  onIndirOgrenci: () => void;
  onIndirOgretmen: () => void;
}) {
  const [yakin, setYakin] = useState(100);
  const [tam, setTam] = useState(false);
  const [bakilan, setBakilan] = useState(1);

  useEffect(() => {
    setBakilan(1);
  }, [url]);

  const cerceve = url ? `${url}#page=${bakilan}` : undefined;

  const yazdir = () => {
    if (!url) return;
    const w = window.open(url);
    if (!w) return;
    w.addEventListener("load", () => w.print());
  };

  const govde = (
    <div className={`flex h-full min-h-0 flex-col ${tam ? "fixed inset-0 z-50 bg-slate-100 p-3" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-700" data-test="foy-sayfa-sayisi">
          {sayfa} sayfa
        </span>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => setBakilan((n) => Math.max(1, n - 1))}
          disabled={bakilan <= 1}
        >
          Önceki
        </button>
        <span className="text-xs text-slate-500">
          {bakilan} / {Math.max(1, sayfa)}
        </span>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => setBakilan((n) => Math.min(sayfa, n + 1))}
          disabled={bakilan >= sayfa}
        >
          Sonraki
        </button>
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setYakin((z) => Math.max(60, z - 10))}>
          −
        </button>
        <span className="text-xs">{yakin}%</span>
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setYakin((z) => Math.min(160, z + 10))}>
          +
        </button>
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setTam((v) => !v)}>
          <Maximize2 size={12} className="inline" /> {tam ? "Kapat" : "Tam ekran"}
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onIndirOgrenci}
          className="flex items-center gap-1 rounded-lg bg-dershanem-navy px-2.5 py-1.5 text-xs font-semibold text-white"
          data-test="foy-pdf-uret"
        >
          <Download size={13} /> Öğrenci PDF
        </button>
        <button
          type="button"
          onClick={onIndirOgretmen}
          className="flex items-center gap-1 rounded-lg border border-dershanem-navy px-2.5 py-1.5 text-xs font-semibold text-dershanem-navy"
          data-test="foy-pdf-ogretmen"
        >
          <Download size={13} /> Öğretmen PDF
        </button>
        <button type="button" onClick={yazdir} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs">
          <Printer size={13} /> Yazdır
        </button>
        {uretiliyor ? <Loader2 size={14} className="animate-spin text-slate-400" /> : null}
      </div>
      {hata ? <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{hata}</p> : null}
      <div className="min-h-0 flex-1 overflow-auto rounded border bg-slate-200">
        {cerceve ? (
          <iframe
            key={`${cerceve}-${yakin}`}
            src={cerceve}
            title="Föy önizleme"
            className="border-0 bg-white"
            style={{ width: `${yakin}%`, height: tam ? "100%" : "72vh", minWidth: 280 }}
          />
        ) : (
          <p className="p-6 text-center text-xs text-slate-500">Önizleme hazırlanıyor.</p>
        )}
      </div>
    </div>
  );

  return govde;
}
