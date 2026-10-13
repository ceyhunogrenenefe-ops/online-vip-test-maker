"use client";

/**
 * İçerik bileşenleri denemesi.
 * Bütün bileşenleri iki sütunlu kurumsal föye akıtır; yapıştırılan
 * içerik de aynı yoldan geçerek PDF'e girer.
 */

import { useCallback, useState } from "react";
import { jsPDF } from "jspdf";
import { registerTurkishFont } from "@/lib/pdf-font";
import { loadBrandKit } from "@/lib/brand-kit";
import {
  corporateFooterHeight,
  corporateHeaderHeight,
  drawCorporateFooterOnAllPages,
  drawCorporateHeader,
} from "@/lib/pdf-corporate";
import { foyPdfOlustur, foyTeshisMesaji } from "@/lib/foy-pdf";
import { yapistirmayiBelgeye } from "@/lib/foy-icerik";
import type { PaperSettings } from "@/types";
import type { DocBlock } from "@/lib/pdf-blocks";
import { renderLatexToPng } from "@/lib/latex-render";
import { cleanFromClipboard } from "@/lib/paste-clean";
import type { PasteBlock } from "@/lib/paste-clean";

/** Yapıştırma bloklarını föy bloklarına çevirir. */
export default function BilesenDenemePage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [disaridan, setDisaridan] = useState<DocBlock[] | null>(null);
  const [metin, setMetin] = useState<string[] | null>(null);

  const ornekBloklar = useCallback(async (): Promise<DocBlock[]> => {
    const f1 = await renderLatexToPng("P = \\frac{F}{A}", { olcek: 4 });
    const f2 = await renderLatexToPng("P = h \\cdot d \\cdot g", { olcek: 4 });
    return [
      { kind: "sectionTitle", text: "KATI BASINCI" },
      {
        kind: "paragraph",
        runs: [
          { text: "Basınç, bir yüzeye " },
          { text: "dik", bold: true },
          { text: " olarak uygulanan kuvvetin, yüzey alanına oranıdır." },
        ],
      },
      { kind: "formula", render: f1 },
      {
        kind: "question",
        no: 1,
        stem: [{ text: "Yüzey alanı yarıya indirilirse basınç nasıl değişir?" }],
        options: [
          { label: "A", runs: [{ text: "İki katına çıkar" }] },
          { label: "B", runs: [{ text: "Yarıya iner" }] },
          { label: "C", runs: [{ text: "Değişmez" }] },
          { label: "D", runs: [{ text: "Dörtte birine iner" }] },
        ],
      },
      { kind: "answerLines", count: 3 },
      {
        kind: "infoBox",
        tone: "bilgi",
        title: "HATIRLATMA",
        text: "Kuvvet artarsa basınç artar, yüzey alanı artarsa basınç azalır.",
      },
      { kind: "sectionTitle", text: "SIVI BASINCI" },
      { kind: "formula", render: f2 },
      {
        kind: "list",
        ordered: false,
        items: [
          [{ text: "Derinlik arttıkça basınç artar" }],
          [{ text: "Yoğunluk arttıkça basınç artar" }],
          [{ text: "Kabın şekli basıncı etkilemez" }],
        ],
      },
      {
        kind: "table",
        rows: [
          ["Sıvı", "Yoğunluk (g/cm³)"],
          ["Su", "1,0"],
          ["Deniz suyu", "1,03"],
          ["Cıva", "13,6"],
        ],
      },
      {
        kind: "infoBox",
        tone: "dikkat",
        title: "DİKKAT!",
        text: "Sıvı basıncı kabın şekline ve sıvı miktarına bağlı değildir; yalnızca derinliğe ve yoğunluğa bağlıdır.",
      },
      {
        kind: "question",
        no: 2,
        stem: [
          { text: "Derinliği 2 katına çıkarılan bir noktada basınç kaç katına çıkar? (H" },
          { text: "2", sub: true },
          { text: "O için)" },
        ],
        options: [
          { label: "A", runs: [{ text: "1" }] },
          { label: "B", runs: [{ text: "2" }] },
          { label: "C", runs: [{ text: "4" }] },
        ],
      },
      { kind: "answerLines", count: 4 },
    ];
  }, []);

  const uret = useCallback(
    async (bloklar: DocBlock[]) => {
      setHata(null);
      try {
        // Yerlesim artik ortak kutuphanede: uretim foy editoru ile
        // bu demo ayni kodu kullanmazsa ikisi zamanla ayrisir.
        const settings = {
          corporateTemplate: true,
          schoolName: "ONLINE VIP DERSHANE",
          documentKind: "Yazılıya Hazırlık Föyü",
          classSection: "9. SINIF",
          subjectBranch: "FİZİK",
          topicTitle: "Basınç ve Kaldırma Kuvveti",
        } as unknown as PaperSettings;
        const { doc, teshis } = await foyPdfOlustur(bloklar, settings);
        const sayfa = teshis.sayfa;
        const blob = doc.output("blob");

        // Denetim: bilesenler PDF'e gercekten girdi mi, metin secilebilir mi
        try {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
          const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
          const parcalar: string[] = [];
          for (let s = 1; s <= pdf.numPages; s++) {
            const sayfa = await pdf.getPage(s);
            const ic = await sayfa.getTextContent();
            ic.items.forEach((it) => {
              if ("str" in it && it.str.trim()) parcalar.push(it.str);
            });
          }
          setMetin(parcalar);
        } catch {
          setMetin(null);
        }
        setPdfUrl((eski) => {
          if (eski) URL.revokeObjectURL(eski);
          return URL.createObjectURL(blob);
        });
        const uyari = foyTeshisMesaji(teshis);
        setBilgi(
          `${sayfa} sayfa · ${teshis.cizilen}/${teshis.verilen} bileşen` +
            (uyari ? ` · ${uyari}` : "")
        );
      } catch (e) {
        setHata(e instanceof Error ? e.message : String(e));
      }
    },
    []
  );

  const yapistir = useCallback(
    async (e: React.ClipboardEvent) => {
      e.preventDefault();
      const r = cleanFromClipboard(e.clipboardData);
      const b = await yapistirmayiBelgeye(r.blocks);
      setDisaridan(b.bloklar);
      setBilgi(
        `Yapıştırılan içerikten ${b.bloklar.length} bileşen üretildi` +
          (b.uyarilar.length ? ` · ${b.uyarilar.join(" · ")}` : "")
      );
    },
    []
  );

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">İçerik bileşenleri</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bölüm başlığı, paragraf, formül, soru, çizgili cevap alanı, bilgi ve
            dikkat kutusu, liste, tablo — iki sütunlu kurumsal föye akıtılır.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => void uret(await ornekBloklar())}
            className="rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52]"
            data-test="ornek-uret"
          >
            Örnek föyü üret
          </button>
          <button
            type="button"
            disabled={!disaridan}
            onClick={() => disaridan && void uret(disaridan)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
          >
            Yapıştırılandan üret
          </button>
        </div>

        <div
          onPaste={yapistir}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[70px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-3 text-sm text-slate-400 outline-none focus:border-[#173b70]"
        >
          Word/Docs içeriğini buraya yapıştırıp &quot;Yapıştırılandan üret&quot;e basın…
        </div>

        {bilgi && <p className="text-xs text-slate-500" data-test="bilgi">{bilgi}</p>}
        {hata && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{hata}</p>}

        {metin && (
          <p className="text-xs text-slate-500" data-test="pdf-metin">
            {metin.join(" | ")}
          </p>
        )}

        {pdfUrl && (
          <iframe
            src={pdfUrl}
            title="Bileşen föyü"
            className="h-[1000px] w-full rounded-xl border border-slate-300 bg-white"
          />
        )}
      </div>
    </main>
  );
}
