"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { UretilenSoru } from "@/lib/soru-uret-ayristir";
import type { PasteBlock } from "@/lib/paste-clean";

/**
 * YZ ile alternatif soru üretimi.
 *
 * Üretilen hiçbir soru doğrudan föye girmez: öğretmen tek tek seçer,
 * metnini düzenleyebilir ve son onayı verir. Model yanıtı yanlış ya da
 * eksik olabilir; sessizce föye yazmak öğretmenin sorumluluğunu
 * görmediği bir içeriğe bağlar.
 *
 * API anahtarı yalnızca sunucuda (/api/soru-uret); istemciye verilmez.
 */
export function FoyYzSoru({
  sinif,
  brans,
  konu,
  onEkle,
}: {
  sinif: string;
  brans: string;
  konu: string;
  onEkle: (bloklar: PasteBlock[]) => void;
}) {
  const [kaynak, setKaynak] = useState("");
  const [adet, setAdet] = useState(3);
  const [zorluk, setZorluk] = useState("ayni");
  const [sorular, setSorular] = useState<UretilenSoru[]>([]);
  const [secili, setSecili] = useState<Set<number>>(new Set());
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const uret = async () => {
    if (!kaynak.trim()) {
      setHata("Örnek alınacak kaynak soruyu yazın.");
      return;
    }
    setHata(null);
    setCalisiyor(true);
    setSorular([]);
    setSecili(new Set());
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
      setCalisiyor(false);
    }
  };

  const ekle = () => {
    const bloklar: PasteBlock[] = [];
    sorular.forEach((s, i) => {
      if (!secili.has(i)) return;
      bloklar.push({
        kind: "question",
        stem: [{ text: s.stem }],
        options: s.options.map((o) => ({ label: o.label, runs: [{ text: o.text }] })),
      });
    });
    if (!bloklar.length) {
      setHata("Föye eklenecek soru seçilmedi.");
      return;
    }
    onEkle(bloklar);
    setSorular([]);
    setSecili(new Set());
  };

  return (
    <div className="space-y-2">
      <textarea
        value={kaynak}
        onChange={(e) => setKaynak(e.target.value)}
        rows={4}
        placeholder="Örnek alınacak soruyu buraya yazın veya yapıştırın…"
        className="w-full rounded-lg border border-slate-300 p-2 text-xs"
        data-test="foy-yz-kaynak"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          Adet
          <select
            value={adet}
            onChange={(e) => setAdet(Number(e.target.value))}
            className="rounded border border-slate-300 px-1 py-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Zorluk
          <select
            value={zorluk}
            onChange={(e) => setZorluk(e.target.value)}
            className="rounded border border-slate-300 px-1 py-1"
          >
            <option value="kolay">Kolay</option>
            <option value="ayni">Aynı</option>
            <option value="zor">Zor</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void uret()}
          disabled={calisiyor}
          className="flex items-center gap-1 rounded-lg bg-dershanem-navy px-3 py-1.5 font-semibold text-white disabled:opacity-60"
          data-test="foy-yz-uret"
        >
          {calisiyor ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Üret
        </button>
      </div>

      {hata ? <p className="rounded bg-red-50 p-2 text-xs text-red-700">{hata}</p> : null}

      {sorular.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="mb-2 text-[11px] text-slate-600">
            Föye eklenecek soruları seçin. Cevap anahtarı ve açıklama föye yazılmaz, yalnız
            kontrol için gösterilir.
          </p>
          <ul className="mb-2 max-h-60 space-y-2 overflow-y-auto">
            {sorular.map((s, i) => (
              <li key={i} className="rounded border border-slate-200 bg-white p-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={secili.has(i)}
                    onChange={(e) =>
                      setSecili((p) => {
                        const n = new Set(p);
                        if (e.target.checked) n.add(i);
                        else n.delete(i);
                        return n;
                      })
                    }
                    className="mt-1"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">{s.stem}</p>
                    <ul className="mt-1 text-slate-600">
                      {s.options.map((o) => (
                        <li key={o.label}>
                          {o.label}) {o.text}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      Cevap: {s.answer}
                      {s.explanation ? ` — ${s.explanation}` : ""}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={ekle}
            className="rounded-lg bg-dershanem-navy px-3 py-1.5 text-xs font-semibold text-white"
            data-test="foy-yz-ekle"
          >
            Seçili {secili.size} soruyu föye ekle
          </button>
        </div>
      ) : null}
    </div>
  );
}
