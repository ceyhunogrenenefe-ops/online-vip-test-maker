"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HavuzVeri } from "@/components/deneme/DenemeStudyo";
import { HavuzGorsel } from "@/components/deneme/HavuzGorsel";
import { formatBul, numaradanDers, tumTestler } from "@/lib/deneme/format";
import { gorselSil, sayfaOku, sorulariOku, sorulariYaz, type HavuzPdf, type HavuzSoru } from "@/lib/deneme/havuz";
import { soruYenidenKes } from "@/lib/deneme/ice-aktar";
import type { Kutu, Sik } from "@/lib/deneme/model";
import { secimiUygula, type SecimKenari } from "@/lib/kirp-secim";

const TUTAMAK: { k: Exclude<SecimKenari, "tasi">; c: string }[] = [
  { k: "nw", c: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { k: "ne", c: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  { k: "sw", c: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  { k: "se", c: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
  { k: "n", c: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { k: "s", c: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
  { k: "w", c: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { k: "e", c: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
];

type Surukle = { id: string | null; kenar: SecimKenari; bas: Kutu; x: number; y: number };

export function PdfInceleme({
  pdf,
  veri,
  yenile,
  kapat,
}: {
  pdf: HavuzPdf;
  veri: HavuzVeri;
  yenile: () => Promise<void>;
  kapat: () => void;
}) {
  const format = formatBul(pdf.formatId);
  const testler = tumTestler(format);
  const harfler = "ABCDE".slice(0, format.sikSayisi).split("") as Sik[];
  const [sayfa, setSayfa] = useState(1);
  const [sayfaUrl, setSayfaUrl] = useState<string | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [cizim, setCizim] = useState(false);
  const [taslak, setTaslak] = useState<{ id: string | null; kutu: Kutu } | null>(null);
  const [anahtarMetin, setAnahtarMetin] = useState("");
  const [anahtarTest, setAnahtarTest] = useState(pdf.tekTest ?? 0);
  const [mesaj, setMesaj] = useState("");
  const alan = useRef<HTMLDivElement>(null);
  const surukle = useRef<Surukle | null>(null);
  const olcu = pdf.sayfalar[sayfa - 1];

  const sorular = useMemo(
    () =>
      veri.sorular
        .filter((s) => s.pdfId === pdf.id)
        .sort(
          (a, b) =>
            testler.findIndex((t) => t.ad === a.test) - testler.findIndex((t) => t.ad === b.test) ||
            (a.numara ?? 0) - (b.numara ?? 0)
        ),
    [veri.sorular, pdf.id, testler]
  );
  const sayfaSorulari = sorular.filter((s) => s.sayfa === sayfa);
  const sayfaGruplari = veri.gruplar.filter((g) => g.pdfId === pdf.id);
  const seciliSoru = sorular.find((s) => s.id === secili) ?? null;

  useEffect(() => {
    let u: string | null = null;
    let iptal = false;
    setSayfaUrl(null);
    void sayfaOku(pdf.id, sayfa).then((b) => {
      if (!b || iptal) return;
      u = URL.createObjectURL(b);
      setSayfaUrl(u);
    });
    return () => {
      iptal = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [pdf.id, sayfa]);

  const kaydet = async (degisen: HavuzSoru[], silinen: string[] = []) => {
    const tum = await sorulariOku();
    const harita = new Map(degisen.map((s) => [s.id, s]));
    const yeni = tum.filter((s) => !silinen.includes(s.id)).map((s) => harita.get(s.id) ?? s);
    for (const s of degisen) if (!tum.some((t) => t.id === s.id)) yeni.push(s);
    await sorulariYaz(yeni);
    for (const id of silinen) await gorselSil(id);
    await yenile();
  };

  const nokta = (e: React.PointerEvent) => {
    const r = alan.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * olcu.genislik,
      y: ((e.clientY - r.top) / r.height) * olcu.yukseklik,
    };
  };

  const yuzde = (k: Kutu) => ({
    left: `${(k.x / olcu.genislik) * 100}%`,
    top: `${(k.y / olcu.yukseklik) * 100}%`,
    width: `${(k.w / olcu.genislik) * 100}%`,
    height: `${(k.h / olcu.yukseklik) * 100}%`,
  });

  const birak = async () => {
    const s = surukle.current;
    const t = taslak;
    surukle.current = null;
    setTaslak(null);
    if (!s || !t || t.kutu.w < 12 || t.kutu.h < 12) return;
    if (s.id) {
      const eski = sorular.find((q) => q.id === s.id);
      if (!eski) return;
      await kaydet([await soruYenidenKes(pdf, { ...eski, kutu: t.kutu })]);
      return;
    }
    // Yeni soru: seçili sorunun testinde, son numaradan sonra.
    const testAd = seciliSoru?.test ?? testler[pdf.tekTest ?? 0].ad;
    const test = testler.find((x) => x.ad === testAd)!;
    const numara = Math.max(0, ...sorular.filter((q) => q.test === testAd).map((q) => q.numara ?? 0)) + 1;
    const yeni: HavuzSoru = {
      id: crypto.randomUUID(),
      pdfId: pdf.id,
      formatId: pdf.formatId,
      test: testAd,
      ders: numaradanDers(test, numara),
      numara,
      dogru: null,
      sayfa,
      kutu: t.kutu,
      noKutu: null,
      grupId: null,
      kullanim: 0,
      surum: Date.now(),
    };
    await kaydet([await soruYenidenKes(pdf, yeni)]);
    setSecili(yeni.id);
    setCizim(false);
  };

  const alanAlt = (s: HavuzSoru, patch: Partial<HavuzSoru>) => kaydet([{ ...s, ...patch }]);

  const anahtarUygula = async () => {
    const metin = anahtarMetin.toUpperCase();
    const hedef = sorular.filter((s) => s.test === testler[anahtarTest].ad);
    const degisen: HavuzSoru[] = [];
    if (/^[A-E\s,;]+$/.test(metin)) {
      const harf = metin.replace(/[^A-E]/g, "").split("") as Sik[];
      hedef.forEach((s, i) => harf[i] && degisen.push({ ...s, dogru: harf[i] }));
    } else {
      for (const m of metin.matchAll(/(\d{1,3})\s*[-.):]?\s*([A-E])/g)) {
        const s = hedef.find((q) => q.numara === Number(m[1]));
        if (s) degisen.push({ ...s, dogru: m[2] as Sik });
      }
    }
    if (!degisen.length) {
      setMesaj("Eşleşen cevap bulunamadı. Örnek: ABCDA… ya da 1-A 2-C …");
      return;
    }
    await kaydet(degisen);
    setMesaj(`${degisen.length} sorunun cevabı girildi.`);
    setAnahtarMetin("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border bg-white px-3 py-1 text-sm" onClick={kapat}>
          ← PDF listesi
        </button>
        <h2 className="text-lg font-bold text-dershanem-navy">{pdf.ad}</h2>
        <span className="text-sm text-slate-500">
          {sorular.length} soru · {sorular.filter((s) => s.dogru).length} cevaplı
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl bg-white p-3 shadow">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className="rounded border px-2 py-1" disabled={sayfa <= 1} onClick={() => setSayfa(sayfa - 1)}>
              ‹
            </button>
            <span>
              Sayfa {sayfa}/{pdf.sayfaSayisi}
              {olcu.ocr ? " · OCR" : ""}
            </span>
            <button type="button" className="rounded border px-2 py-1" disabled={sayfa >= pdf.sayfaSayisi} onClick={() => setSayfa(sayfa + 1)}>
              ›
            </button>
            <button
              type="button"
              className={`ml-auto rounded px-3 py-1 font-semibold ${cizim ? "bg-dershanem-accent text-white" : "border"}`}
              onClick={() => setCizim((v) => !v)}
            >
              {cizim ? "Sayfada kutu çiz…" : "+ Yeni soru kutusu"}
            </button>
          </div>
          <div className="overflow-auto">
            <div
              ref={alan}
              className={`relative mx-auto w-full max-w-[820px] select-none touch-none ${cizim ? "cursor-crosshair" : ""}`}
              style={{ aspectRatio: `${olcu.genislik} / ${olcu.yukseklik}` }}
              onPointerDown={(e) => {
                if (!cizim) return;
                const p = nokta(e);
                surukle.current = { id: null, kenar: "se", bas: { x: p.x, y: p.y, w: 0, h: 0 }, x: p.x, y: p.y };
                setTaslak({ id: null, kutu: { x: p.x, y: p.y, w: 0, h: 0 } });
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const s = surukle.current;
                if (!s) return;
                const p = nokta(e);
                const c = secimiUygula(
                  { x: s.bas.x, y: s.bas.y, width: s.bas.w, height: s.bas.h },
                  p.x - s.x,
                  p.y - s.y,
                  s.kenar,
                  olcu.genislik,
                  olcu.yukseklik
                );
                setTaslak({ id: s.id, kutu: { x: c.x, y: c.y, w: c.width, h: c.height } });
              }}
              onPointerUp={() => void birak()}
            >
              {sayfaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sayfaUrl} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-slate-100" />
              )}
              {sayfaGruplari.flatMap((g) =>
                g.parcalar
                  .filter((p) => p.sayfa === sayfa)
                  .map((p, i) => (
                    <div
                      key={`${g.id}-${i}`}
                      className="pointer-events-none absolute border-2 border-dashed border-purple-500 bg-purple-400/5"
                      style={yuzde(p.kutu)}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-purple-600 px-1 text-[10px] text-white">Ortak metin</span>
                    </div>
                  ))
              )}
              {sayfaSorulari.map((s) => {
                const kutu = taslak?.id === s.id ? taslak.kutu : s.kutu;
                const aktif = s.id === secili;
                return (
                  <div
                    key={s.id}
                    className={`absolute border-2 ${aktif ? "z-10 border-red-600 bg-red-500/10" : s.dogru ? "border-green-600 bg-green-500/5" : "border-amber-500 bg-amber-400/5"}`}
                    style={yuzde(kutu)}
                    onPointerDown={(e) => {
                      if (cizim) return;
                      e.stopPropagation();
                      setSecili(s.id);
                      const p = nokta(e);
                      surukle.current = { id: s.id, kenar: "tasi", bas: s.kutu, x: p.x, y: p.y };
                      alan.current?.setPointerCapture(e.pointerId);
                    }}
                  >
                    <span className={`absolute left-0 top-0 rounded-br px-1 text-xs font-bold text-white ${aktif ? "bg-red-600" : s.dogru ? "bg-green-600" : "bg-amber-500"}`}>
                      {s.numara ?? "?"}
                      {s.dogru ? ` · ${s.dogru}` : ""}
                    </span>
                    {aktif && !cizim
                      ? TUTAMAK.map((t) => (
                          <span
                            key={t.k}
                            className={`absolute h-3.5 w-3.5 rounded-sm border-2 border-red-600 bg-white ${t.c}`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const p = nokta(e);
                              surukle.current = { id: s.id, kenar: t.k, bas: s.kutu, x: p.x, y: p.y };
                              alan.current?.setPointerCapture(e.pointerId);
                            }}
                          />
                        ))
                      : null}
                  </div>
                );
              })}
              {taslak && !taslak.id ? (
                <div className="absolute border-2 border-dershanem-accent bg-amber-300/20" style={yuzde(taslak.kutu)} />
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Kutuyu sürükleyerek taşı, köşelerden boyutlandır. Bıraktığında soru yeniden kesilir. Yeşil: cevaplı, turuncu: cevap eksik.
          </p>
        </section>

        <aside className="space-y-3">
          <section className="rounded-xl bg-white p-3 shadow">
            <h3 className="font-bold text-dershanem-navy">Seçili soru</h3>
            {seciliSoru ? (
              <div className="mt-2 space-y-2 text-sm">
                <HavuzGorsel id={seciliSoru.id} surum={seciliSoru.surum} className="max-h-72 w-full rounded border object-contain" />
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    Test
                    <select
                      className="mt-1 w-full rounded border px-1 py-1"
                      value={seciliSoru.test}
                      onChange={(e) => {
                        const t = testler.find((x) => x.ad === e.target.value)!;
                        void alanAlt(seciliSoru, { test: t.ad, ders: numaradanDers(t, seciliSoru.numara) });
                      }}
                    >
                      {testler.map((t) => (
                        <option key={t.ad}>{t.ad}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Numara
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded border px-1 py-1"
                      value={seciliSoru.numara ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value) || null;
                        const t = testler.find((x) => x.ad === seciliSoru.test)!;
                        void alanAlt(seciliSoru, { numara: n, ders: numaradanDers(t, n) });
                      }}
                    />
                  </label>
                </div>
                <label className="block">
                  Ders
                  <select
                    className="mt-1 w-full rounded border px-1 py-1"
                    value={seciliSoru.ders}
                    onChange={(e) => void alanAlt(seciliSoru, { ders: e.target.value })}
                  >
                    {testler
                      .find((t) => t.ad === seciliSoru.test)
                      ?.dersler.map((d) => <option key={d.ad}>{d.ad}</option>)}
                  </select>
                </label>
                <div>
                  Doğru cevap
                  <div className="mt-1 flex gap-1">
                    {harfler.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`h-8 w-8 rounded-full border font-bold ${seciliSoru.dogru === h ? "border-green-700 bg-green-600 text-white" : ""}`}
                        onClick={() => void alanAlt(seciliSoru, { dogru: seciliSoru.dogru === h ? null : h })}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-red-700"
                  onClick={async () => {
                    await kaydet([], [seciliSoru.id]);
                    setSecili(null);
                  }}
                >
                  Soruyu sil
                </button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Sayfada bir kutuya ya da aşağıdaki listeden bir soruya tıkla.</p>
            )}
          </section>

          <section className="rounded-xl bg-white p-3 shadow text-sm">
            <h3 className="font-bold text-dershanem-navy">Cevap anahtarını elle gir</h3>
            <p className="mt-1 text-xs text-slate-500">
              Anahtar PDF’te yoksa (karekodlu vb.) buraya yaz: <b>ABCDA…</b> sırayla ya da <b>1-A 2-C …</b>
            </p>
            <select
              className="mt-2 w-full rounded border px-1 py-1"
              value={anahtarTest}
              onChange={(e) => setAnahtarTest(Number(e.target.value))}
            >
              {testler.map((t, i) => (
                <option key={t.ad} value={i}>
                  {t.ad} ({sorular.filter((s) => s.test === t.ad).length} soru)
                </option>
              ))}
            </select>
            <textarea
              className="mt-2 h-20 w-full rounded border p-2 font-mono"
              value={anahtarMetin}
              onChange={(e) => setAnahtarMetin(e.target.value)}
              placeholder="ABCDDCBA…"
            />
            <button type="button" className="mt-1 rounded bg-dershanem-navy px-3 py-1 text-white" onClick={() => void anahtarUygula()}>
              Uygula
            </button>
            {mesaj ? <p className="mt-1 text-xs text-slate-700">{mesaj}</p> : null}
          </section>
        </aside>
      </div>

      <section className="rounded-xl bg-white p-3 shadow">
        <h3 className="font-bold text-dershanem-navy">Kesilen sorular</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sorular.map((s) => (
            <div
              key={s.id}
              className={`cursor-pointer rounded-lg border p-2 ${s.id === secili ? "border-red-500 ring-2 ring-red-200" : ""}`}
              onClick={() => {
                setSecili(s.id);
                setSayfa(s.sayfa);
              }}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {s.test === s.ders ? s.ders : `${s.test} › ${s.ders}`} {s.numara}
                </span>
                {s.grupId ? <span className="rounded bg-purple-100 px-1 text-purple-700">ortak</span> : null}
              </div>
              <HavuzGorsel id={s.id} surum={s.surum} className="h-28 w-full rounded bg-white object-contain object-top" />
              <div className="mt-1 flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                {harfler.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`h-6 flex-1 rounded text-xs font-bold ${s.dogru === h ? "bg-green-600 text-white" : "bg-slate-100"}`}
                    onClick={() => void alanAlt(s, { dogru: s.dogru === h ? null : h })}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
