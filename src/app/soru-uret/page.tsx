"use client";

/**
 * Yapay zekâ ile alternatif soru üretimi.
 *
 * Üretilen sorular TASLAKTIR. Öğretmen tek tek onaylamadan hiçbiri
 * föye girmez; arayüz bunu açıkça söyler (spec kural 5).
 */

import { useCallback, useState } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react";

type UretilenSoru = {
  stem: string;
  options: { label: string; text: string }[];
  answer: string;
  explanation?: string;
};

const ORNEK = `1. Yüzey alanı 0,5 m² olan bir cisim, zemine 200 N kuvvet uyguluyor.
Cismin zemine uyguladığı basınç kaç Pa'dır?
A) 100
B) 200
C) 400
D) 800`;

export default function SoruUretPage() {
  const [kaynak, setKaynak] = useState(ORNEK);
  const [sinif, setSinif] = useState("9. Sınıf");
  const [brans, setBrans] = useState("Fizik");
  const [konu, setKonu] = useState("Basınç");
  const [zorluk, setZorluk] = useState<"kolay" | "orta" | "zor">("orta");
  const [adet, setAdet] = useState(3);

  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sorular, setSorular] = useState<UretilenSoru[]>([]);
  const [onayli, setOnayli] = useState<Set<number>>(new Set());

  const uret = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    setSorular([]);
    setOnayli(new Set());
    try {
      const r = await fetch("/api/soru-uret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kaynakSoru: kaynak, sinif, brans, konu, adet, zorluk }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSorular(j.sorular || []);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setYukleniyor(false);
    }
  }, [kaynak, sinif, brans, konu, adet, zorluk]);

  const cevir = (i: number) =>
    setOnayli((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Alternatif soru üretimi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Elinizdeki bir soruya benzer, aynı kazanımı ölçen yeni sorular
            üretir.
          </p>
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Üretilen sorular <b className="mx-1">taslaktır</b>. Doğruluğunu
            kontrol etmeden föye eklemeyin; yapay zekâ hatalı çeldirici veya
            yanlış cevap anahtarı üretebilir.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-slate-600">
            Sınıf
            <input
              value={sinif}
              onChange={(e) => setSinif(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Branş
            <input
              value={brans}
              onChange={(e) => setBrans(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Konu
            <input
              value={konu}
              onChange={(e) => setKonu(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Zorluk
            <select
              value={zorluk}
              onChange={(e) => setZorluk(e.target.value as typeof zorluk)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="kolay">Kolay</option>
              <option value="orta">Orta</option>
              <option value="zor">Zor</option>
            </select>
          </label>
        </div>

        <label className="block text-xs text-slate-600">
          Örnek soru
          <textarea
            value={kaynak}
            onChange={(e) => setKaynak(e.target.value)}
            rows={7}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            Adet
            <select
              value={adet}
              onChange={(e) => setAdet(Number(e.target.value))}
              className="ml-1.5 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void uret()}
            disabled={yukleniyor || !kaynak.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52] disabled:opacity-40"
            data-test="uret"
          >
            {yukleniyor ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Soru üret
          </button>
        </div>

        {hata && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" data-test="hata">
            {hata}
          </p>
        )}

        {sorular.length > 0 && (
          <div className="space-y-3" data-test="sorular">
            <p className="text-xs text-slate-500">
              {sorular.length} taslak soru · onayladığınız{" "}
              <b>{onayli.size}</b> tanesi föye eklenebilir
            </p>
            {sorular.map((s, i) => {
              const sec = onayli.has(i);
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-3 ${
                    sec ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{s.stem}</p>
                  <ul className="mt-2 space-y-1">
                    {s.options.map((o) => (
                      <li
                        key={o.label}
                        className={`text-sm ${
                          o.label === s.answer
                            ? "font-semibold text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        <b>{o.label})</b> {o.text}
                        {o.label === s.answer && " ✓"}
                      </li>
                    ))}
                  </ul>
                  {s.explanation && (
                    <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                      {s.explanation}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => cevir(i)}
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      sec
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-300 text-slate-700"
                    }`}
                  >
                    {sec ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {sec ? "Onaylandı" : "Onayla"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
