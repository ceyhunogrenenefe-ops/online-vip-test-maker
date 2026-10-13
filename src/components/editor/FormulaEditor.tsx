"use client";

/**
 * Görsel matematik formülü editörü.
 *
 * Öğretmen üç yoldan da çalışabilsin diye tasarlandı (spec 3. madde):
 *  1) Görsel olarak yazarak — MathLive alanı, LaTeX bilmeye gerek yok
 *  2) LaTeX yapıştırarak — kaynak kutusu çift yönlü bağlı
 *  3) Sembol menüsünden seçerek — hazır şablonlar
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { LatexError, renderLatexToPng, validateLatex } from "@/lib/latex-render";
import type { RenderedFormula } from "@/lib/latex-render";

type MathfieldEl = HTMLElement & {
  value: string;
  executeCommand?: (cmd: string | [string, ...unknown[]]) => void;
  insert?: (s: string, opts?: Record<string, unknown>) => void;
};

/** Sembol menüsü — kurumun branşlarına göre gruplandı */
const SEMBOLLER: { baslik: string; ogeler: { etiket: string; latex: string }[] }[] = [
  {
    baslik: "Temel",
    ogeler: [
      { etiket: "a/b", latex: "\\frac{#0}{#?}" },
      { etiket: "xⁿ", latex: "#0^{#?}" },
      { etiket: "xₙ", latex: "#0_{#?}" },
      { etiket: "√", latex: "\\sqrt{#0}" },
      { etiket: "ⁿ√", latex: "\\sqrt[#?]{#0}" },
      { etiket: "±", latex: "\\pm" },
      { etiket: "·", latex: "\\cdot" },
      { etiket: "÷", latex: "\\div" },
    ],
  },
  {
    baslik: "Karşılaştırma",
    ogeler: [
      { etiket: "≠", latex: "\\neq" },
      { etiket: "≤", latex: "\\leq" },
      { etiket: "≥", latex: "\\geq" },
      { etiket: "≈", latex: "\\approx" },
      { etiket: "∝", latex: "\\propto" },
      { etiket: "→", latex: "\\rightarrow" },
    ],
  },
  {
    baslik: "Analiz",
    ogeler: [
      { etiket: "∫", latex: "\\int_{#?}^{#?} #0 \\,dx" },
      { etiket: "d/dx", latex: "\\frac{d}{dx}#0" },
      { etiket: "lim", latex: "\\lim_{#? \\to #?} #0" },
      { etiket: "Σ", latex: "\\sum_{#?}^{#?} #0" },
      { etiket: "∞", latex: "\\infty" },
    ],
  },
  {
    baslik: "Trigonometri",
    ogeler: [
      { etiket: "sin", latex: "\\sin(#0)" },
      { etiket: "cos", latex: "\\cos(#0)" },
      { etiket: "tan", latex: "\\tan(#0)" },
      { etiket: "°", latex: "^{\\circ}" },
      { etiket: "π", latex: "\\pi" },
      { etiket: "θ", latex: "\\theta" },
    ],
  },
  {
    baslik: "Geometri",
    ogeler: [
      { etiket: "∠", latex: "\\angle" },
      { etiket: "△", latex: "\\triangle" },
      { etiket: "∥", latex: "\\parallel" },
      { etiket: "⊥", latex: "\\perp" },
      { etiket: "≅", latex: "\\cong" },
      { etiket: "∼", latex: "\\sim" },
    ],
  },
  {
    baslik: "Fizik / Kimya",
    ogeler: [
      { etiket: "vektör", latex: "\\vec{#0}" },
      { etiket: "Δ", latex: "\\Delta" },
      { etiket: "⇌", latex: "\\rightleftharpoons" },
      { etiket: "↑", latex: "\\uparrow" },
      { etiket: "↓", latex: "\\downarrow" },
      { etiket: "matris", latex: "\\begin{pmatrix} #0 & #? \\\\ #? & #? \\end{pmatrix}" },
    ],
  },
];

/** Sık kullanılan hazır formüller — öğretmenin sıfırdan yazmasına gerek kalmasın */
const HAZIR: { ad: string; latex: string }[] = [
  { ad: "Basınç", latex: "P = \\frac{F}{A}" },
  { ad: "Sıvı basıncı", latex: "P = h \\cdot d \\cdot g" },
  { ad: "Kaldırma kuvveti", latex: "F_{k} = V \\cdot d_{s} \\cdot g" },
  { ad: "İkinci derece", latex: "x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}" },
  { ad: "Pisagor", latex: "a^{2} + b^{2} = c^{2}" },
  { ad: "Mol", latex: "n = \\frac{m}{M_{A}}" },
];

interface Props {
  /** Başlangıç LaTeX'i — düzenleme için */
  baslangic?: string;
  onKaydet: (sonuc: { latex: string; gorsel: RenderedFormula }) => void;
  onKapat: () => void;
}

export function FormulaEditor({ baslangic = "", onKaydet, onKapat }: Props) {
  const alanRef = useRef<MathfieldEl | null>(null);
  const kapsayiciRef = useRef<HTMLDivElement | null>(null);
  const [latex, setLatex] = useState(baslangic);
  const [hata, setHata] = useState<string | null>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [hazir, setHazir] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // MathLive bir web bileşeni; yalnızca tarayıcıda yüklenir.
  useEffect(() => {
    let iptal = false;
    (async () => {
      await import("mathlive");
      if (iptal || !kapsayiciRef.current) return;
      const el = document.createElement("math-field") as MathfieldEl;
      el.setAttribute("virtual-keyboard-mode", "manual");
      el.style.width = "100%";
      el.style.fontSize = "22px";
      el.style.padding = "10px";
      el.style.border = "1px solid #cbd5e1";
      el.style.borderRadius = "10px";
      el.value = baslangic;
      el.addEventListener("input", () => setLatex(el.value));
      kapsayiciRef.current.appendChild(el);
      alanRef.current = el;
      setHazir(true);
    })();
    return () => {
      iptal = true;
      alanRef.current?.remove();
      alanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LaTeX kutusundan yazılırsa görsel alanı da güncellensin (çift yönlü)
  const latexKutusundanYaz = useCallback((deger: string) => {
    setLatex(deger);
    if (alanRef.current && alanRef.current.value !== deger) {
      alanRef.current.value = deger;
    }
  }, []);

  const ekle = useCallback((parca: string) => {
    const el = alanRef.current;
    if (!el) return;
    if (el.insert) el.insert(parca, { focus: true });
    else el.value = el.value + parca;
    setLatex(el.value);
  }, []);

  // Anlık geçerlilik + önizleme
  useEffect(() => {
    let iptal = false;
    const t = setTimeout(async () => {
      if (!latex.trim()) {
        setHata(null);
        setOnizleme(null);
        return;
      }
      const h = await validateLatex(latex);
      if (iptal) return;
      setHata(h);
      if (h) {
        setOnizleme(null);
        return;
      }
      try {
        const g = await renderLatexToPng(latex, { olcek: 2 });
        if (!iptal) setOnizleme(g.dataUrl);
      } catch {
        if (!iptal) setOnizleme(null);
      }
    }, 350);
    return () => {
      iptal = true;
      clearTimeout(t);
    };
  }, [latex]);

  const kaydedilebilir = useMemo(
    () => Boolean(latex.trim()) && !hata && !kaydediliyor,
    [latex, hata, kaydediliyor]
  );

  const kaydet = async () => {
    if (!kaydedilebilir) return;
    setKaydediliyor(true);
    try {
      // Baskı için yüksek çözünürlük
      const gorsel = await renderLatexToPng(latex, { olcek: 4 });
      onKaydet({ latex: latex.trim(), gorsel });
    } catch (e) {
      setHata(
        e instanceof LatexError ? e.message : "Formül görsele çevrilemedi"
      );
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold text-slate-800">Formül ekle</h2>
          <button
            type="button"
            onClick={onKapat}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <label className="block text-xs font-semibold text-slate-600">
            Formül
          </label>
          <div ref={kapsayiciRef} className="mt-1.5" />
          {!hazir && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Editör yükleniyor…
            </p>
          )}

          <label className="mt-4 block text-xs font-semibold text-slate-600">
            LaTeX kaynağı — yapıştırabilir veya elle düzenleyebilirsiniz
          </label>
          <textarea
            value={latex}
            onChange={(e) => latexKutusundanYaz(e.target.value)}
            rows={2}
            spellCheck={false}
            className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 font-mono text-sm"
            placeholder="\frac{F}{A}"
          />

          {hata && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {hata}
            </p>
          )}

          {onizleme && !hata && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-[#edf5fb] p-4 text-center">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                PDF&apos;te böyle görünecek
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={onizleme}
                alt="Formül önizlemesi"
                className="mx-auto max-h-24"
                data-test="formul-onizleme"
              />
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-600">Hazır formüller</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {HAZIR.map((h) => (
                <button
                  key={h.ad}
                  type="button"
                  onClick={() => latexKutusundanYaz(h.latex)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:border-[#173b70] hover:text-[#173b70]"
                >
                  {h.ad}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {SEMBOLLER.map((grup) => (
              <div key={grup.baslik}>
                <p className="text-xs font-semibold text-slate-600">{grup.baslik}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {grup.ogeler.map((o) => (
                    <button
                      key={o.etiket}
                      type="button"
                      onClick={() => ekle(o.latex)}
                      title={o.latex}
                      className="min-w-[38px] rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:border-[#173b70] hover:bg-[#eef4fa]"
                    >
                      {o.etiket}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-500">
            Formüller PDF&apos;e görsel olarak gömülür; seçilebilir metin değildir.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onKapat}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!kaydedilebilir}
              onClick={() => void kaydet()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52] disabled:opacity-40"
            >
              {kaydediliyor ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Formülü ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
