"use client";

/**
 * Formül editörü deneme sayfası.
 * Editörle üretilen formülün kurumsal şablonlu PDF'e nasıl bastığını gösterir.
 */

import { useCallback, useState } from "react";
import { jsPDF } from "jspdf";
import { FormulaEditor } from "@/components/editor/FormulaEditor";
import { registerTurkishFont, setTurkishFont } from "@/lib/pdf-font";
import { loadBrandKit } from "@/lib/brand-kit";
import {
  KURUMSAL,
  corporateFooterHeight,
  corporateHeaderHeight,
  drawCorporateFooterOnAllPages,
  drawCorporateHeader,
} from "@/lib/pdf-corporate";
import { formulaSizeMm, renderLatexToPng } from "@/lib/latex-render";
import type { RenderedFormula } from "@/lib/latex-render";
import type { PaperSettings } from "@/types";

type Formul = { latex: string; gorsel: RenderedFormula };

const BASLANGIC: Formul[] = [];

export default function FormulDenemePage() {
  const [acik, setAcik] = useState(false);
  const [formuller, setFormuller] = useState<Formul[]>(BASLANGIC);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [uretiliyor, setUretiliyor] = useState(false);

  const pdfUret = useCallback(async () => {
    if (!formuller.length) return;
    setUretiliyor(true);
    setHata(null);
    try {
      await loadBrandKit();
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      await registerTurkishFont(doc);
      const settings = {
        corporateTemplate: true,
        schoolName: "ONLINE VIP DERSHANE",
        documentKind: "Formül Föyü",
        classSection: "9. SINIF",
        subjectBranch: "FİZİK",
        topicTitle: "Formül Denemesi",
        footerSlogan: "Olduğunuz yerden, olmak istediğiniz yere.",
      } as PaperSettings;

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      drawCorporateHeader(doc, settings, pageW, margin);

      let y = corporateHeaderHeight(settings);
      const altSinir = pageH - margin - corporateFooterHeight();
      const icW = pageW - margin * 2;

      for (let i = 0; i < formuller.length; i++) {
        const f = formuller[i];
        // Tum formuller ayni punto gorunsun diye ex olcegiyle boyutlandirilir;
        // sabit kutu yuksekligi kullanilirsa tek satirlik denklem ile iki katli
        // kesir ayni kutuya girip farkli harf boyutuyla cikiyor.
        const olcu = formulaSizeMm(f.gorsel, 13);
        let hedefW = olcu.widthMm;
        let hedefH = olcu.heightMm;
        if (hedefW > icW - 16) {
          // Cok genis formul: sutuna sigdir, orani koru
          const k = (icW - 16) / hedefW;
          hedefW *= k;
          hedefH *= k;
        }
        const kutuH = hedefH + 10;

        if (y + kutuH > altSinir) {
          doc.addPage();
          drawCorporateHeader(doc, settings, pageW, margin);
          y = corporateHeaderHeight(settings);
        }

        doc.setFillColor("#edf5fb");
        doc.roundedRect(margin, y, icW, kutuH, 2, 2, "F");
        doc.setTextColor(KURUMSAL.gri);
        setTurkishFont(doc, "normal");
        doc.setFontSize(7.5);
        doc.text(`${i + 1}.`, margin + 3, y + 5);
        doc.addImage(
          f.gorsel.dataUrl,
          "PNG",
          margin + (icW - hedefW) / 2,
          y + 5,
          hedefW,
          hedefH
        );
        y += kutuH + 4;
      }

      drawCorporateFooterOnAllPages(doc, settings, pageW, pageH, margin);
      const blob = doc.output("blob");
      setPdfUrl((eski) => {
        if (eski) URL.revokeObjectURL(eski);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setUretiliyor(false);
    }
  }, [formuller]);

  const ornekleriYukle = useCallback(async () => {
    setHata(null);
    const ornekler = [
      "P = \\frac{F}{A}",
      "x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}",
      "\\int_{0}^{\\infty} e^{-x^{2}} \\,dx = \\frac{\\sqrt{\\pi}}{2}",
      "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
      "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
      "2H_{2} + O_{2} \\rightarrow 2H_{2}O",
    ];
    try {
      const sonuc: Formul[] = [];
      for (const l of ornekler) {
        sonuc.push({ latex: l, gorsel: await renderLatexToPng(l, { olcek: 4 }) });
      }
      setFormuller(sonuc);
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-lg font-bold text-slate-800">Formül editörü denemesi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Editörle formül ekleyin, kurumsal şablonlu PDF&apos;e nasıl bastığını görün.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAcik(true)}
            className="rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52]"
          >
            Formül ekle
          </button>
          <button
            type="button"
            onClick={() => void ornekleriYukle()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            data-test="ornekleri-yukle"
          >
            Örnekleri yükle (6 formül)
          </button>
          <button
            type="button"
            disabled={!formuller.length || uretiliyor}
            onClick={() => void pdfUret()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            data-test="pdf-uret"
          >
            {uretiliyor ? "Üretiliyor…" : "PDF üret"}
          </button>
        </div>

        {hata && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{hata}</p>
        )}

        <p className="mt-3 text-xs text-slate-500" data-test="formul-sayisi">
          Eklenen formül: {formuller.length}
        </p>

        {formuller.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {formuller.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.gorsel.dataUrl} alt={f.latex} className="max-h-8" />
                <code className="flex-1 truncate text-[11px] text-slate-500">
                  {f.latex}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    setFormuller((l) => l.filter((_, j) => j !== i))
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  sil
                </button>
              </li>
            ))}
          </ul>
        )}

        {pdfUrl && (
          <iframe
            src={pdfUrl}
            title="Formül PDF"
            className="mt-4 h-[900px] w-full rounded-xl border border-slate-300 bg-white"
          />
        )}
      </div>

      {acik && (
        <FormulaEditor
          onKapat={() => setAcik(false)}
          onKaydet={({ latex, gorsel }) => {
            setFormuller((l) => [...l, { latex, gorsel }]);
            setAcik(false);
          }}
        />
      )}
    </main>
  );
}
