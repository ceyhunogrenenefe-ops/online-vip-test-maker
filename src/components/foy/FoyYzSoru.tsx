"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  SORU_TIPLERI,
  ZORLUKLAR,
  type UretilenSoru,
} from "@/lib/soru-uret-ayristir";

/**
 * Üretilen soru föye kendiliğinden yazılmaz. Öğretmen kabul, düzenleme
 * veya yeniden üretimden sonra ekler. Kazanım listesi resmî tablodan
 * seçilebilir; üretilen soru yine MEB onayı sayılmaz.
 */
export function FoyYzSoru({
  sinif,
  brans,
  konu,
  kazanim,
  onKabul,
}: {
  sinif: string;
  brans: string;
  konu: string;
  kazanim: string;
  onKabul: (sorular: UretilenSoru[]) => void;
}) {
  const [komut, setKomut] = useState("");
  const [kaynak, setKaynak] = useState("");
  const [altKonu, setAltKonu] = useState("");
  const [adet, setAdet] = useState(3);
  const [zorluk, setZorluk] = useState<string>("Orta");
  const [soruTipi, setSoruTipi] = useState<string>("Açık uçlu");
  const [hazirlik, setHazirlik] = useState("Yazılıya hazırlık");
  const [sorular, setSorular] = useState<UretilenSoru[]>([]);
  const [secili, setSecili] = useState<Set<number>>(new Set());
  const [cozum, setCozum] = useState<Set<number>>(new Set());
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const iste = async (govde: Record<string, unknown>) => {
    const r = await fetch("/api/soru-uret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j as { sorular: UretilenSoru[]; uyarilar?: string[] };
  };

  const ortak = {
    sinif,
    brans,
    konu,
    altKonu,
    kazanim,
    adet,
    zorluk,
    soruTipi,
    hazirlik,
    komut,
    kaynakSoru: kaynak,
  };

  const uret = async () => {
    if (!kazanim.trim()) {
      setHata("Önce kazanımı seçin. Üretilen sorunun üstünde öğrenci bu kazanımı görecek.");
      return;
    }
    if (!komut.trim() && !kaynak.trim()) {
      setHata("Komut yazın veya örnek soru yapıştırın.");
      return;
    }
    setHata(null);
    setCalisiyor(true);
    setSorular([]);
    setSecili(new Set());
    try {
      const j = await iste(ortak);
      setSorular(j.sorular || []);
      setUyarilar(j.uyarilar || []);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setCalisiyor(false);
    }
  };

  const tek = async (i: number, zorlukYeni: string, benzer = false) => {
    const s = sorular[i];
    if (!s) return;
    setCalisiyor(true);
    setHata(null);
    try {
      const j = await iste({
        ...ortak,
        adet: 1,
        zorluk: zorlukYeni,
        kaynakSoru: s.stem,
        komut: benzer
          ? "Bu soruya benzer, sayıları ve bağlamı değişmiş bir soru yaz."
          : komut,
      });
      const gelen = j.sorular?.[0];
      if (!gelen) throw new Error("Yeni taslak gelmedi");
      setSorular((p) => p.map((x, n) => (n === i ? gelen : x)));
      if (j.uyarilar?.length) setUyarilar(j.uyarilar);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setCalisiyor(false);
    }
  };

  const ekle = () => {
    const secilen = sorular.filter((_, i) => secili.has(i));
    if (!secilen.length) {
      setHata("Föye eklenecek soru seçilmedi.");
      return;
    }
    onKabul(secilen);
    setSorular([]);
    setSecili(new Set());
  };

  const alan = "mt-0.5 w-full rounded border border-slate-300 px-2 py-1";

  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] text-slate-500">
        Telifli kaynak metni ve öğrenci bilgisi yapıştırmayın. Üretilen taslak onayınız olmadan föye girmez.
        Seçilen kazanım her sorunun üstünde basılır; üretilen soru MEB onayı değildir.
      </p>
      <textarea
        value={komut}
        onChange={(e) => setKomut(e.target.value)}
        rows={3}
        placeholder="Örn. 7. sınıf matematik, rasyonel sayılar, orta seviyede 8 açık uçlu soru. Üçü problem olsun."
        className={alan}
        data-test="foy-yz-komut"
      />
      <textarea
        value={kaynak}
        onChange={(e) => setKaynak(e.target.value)}
        rows={3}
        placeholder="İsterseniz örnek soru da yapıştırın. Boş bırakılabilir."
        className={alan}
        data-test="foy-yz-kaynak"
      />
      <div className="grid grid-cols-2 gap-1">
        <label className="col-span-2">
          Alt konu
          <input value={altKonu} onChange={(e) => setAltKonu(e.target.value)} className={alan} />
        </label>
        <label>
          Zorluk
          <select value={zorluk} onChange={(e) => setZorluk(e.target.value)} className={alan}>
            {ZORLUKLAR.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label>
          Soru tipi
          <select value={soruTipi} onChange={(e) => setSoruTipi(e.target.value)} className={alan}>
            {SORU_TIPLERI.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Adet
          <select value={adet} onChange={(e) => setAdet(Number(e.target.value))} className={alan}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hazırlık düzeyi
          <input value={hazirlik} onChange={(e) => setHazirlik(e.target.value)} className={alan} />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void uret()}
        disabled={calisiyor}
        className="flex items-center gap-1 rounded-lg bg-dershanem-navy px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        data-test="foy-yz-uret"
      >
        {calisiyor ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Taslak üret
      </button>
      {hata ? <p className="rounded bg-red-50 p-2 text-red-700">{hata}</p> : null}
      {uyarilar.length > 0 ? (
        <ul className="rounded bg-amber-50 p-2 text-[11px] text-amber-950">
          {uyarilar.map((u) => (
            <li key={u}>• {u}</li>
          ))}
        </ul>
      ) : null}
      {sorular.length > 0 ? (
        <div>
          <ul className="mb-2 max-h-80 space-y-2 overflow-y-auto">
            {sorular.map((s, i) => (
              <li key={`${s.stem.slice(0, 24)}-${i}`} className="rounded border bg-white p-2">
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
                  />
                  <span className="font-semibold">Kabul et</span>
                </label>
                <textarea
                  value={s.stem}
                  rows={3}
                  onChange={(e) =>
                    setSorular((p) => p.map((x, n) => (n === i ? { ...x, stem: e.target.value } : x)))
                  }
                  className="mt-1 w-full rounded border p-1"
                />
                {s.options.length > 0 ? (
                  <ul className="mt-1 text-slate-600">
                    {s.options.map((o) => (
                      <li key={o.label}>
                        {o.label}) {o.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 text-[11px] text-emerald-800">
                  Cevap: {s.answer || "girilmedi — uydurulmadı"}
                </p>
                {cozum.has(i) && s.explanation ? (
                  <p className="mt-1 text-[11px] text-slate-600">{s.explanation}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className="rounded border px-1.5 py-0.5" onClick={() => void tek(i, zorluk)}>
                    Yeniden üret
                  </button>
                  <button type="button" className="rounded border px-1.5 py-0.5" onClick={() => void tek(i, "Kolay")}>
                    Daha kolay
                  </button>
                  <button type="button" className="rounded border px-1.5 py-0.5" onClick={() => void tek(i, "Zor")}>
                    Daha zor
                  </button>
                  <button type="button" className="rounded border px-1.5 py-0.5" onClick={() => void tek(i, zorluk, true)}>
                    Benzer soru
                  </button>
                  <button
                    type="button"
                    className="rounded border px-1.5 py-0.5"
                    onClick={() =>
                      setCozum((p) => {
                        const n = new Set(p);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                  >
                    Çözümünü göster
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={ekle}
            className="rounded-lg bg-dershanem-navy px-3 py-1.5 font-semibold text-white"
            data-test="foy-yz-ekle"
          >
            Seçili {secili.size} soruyu föye ekle
          </button>
        </div>
      ) : null}
    </div>
  );
}
