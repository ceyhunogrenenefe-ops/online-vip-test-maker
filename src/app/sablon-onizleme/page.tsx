"use client";

/**
 * Kurumsal sablonun gercek PDF ciktisini tarayicida gosterir.
 * Gelistirici araci: ayni cizim fonksiyonlarini (pdf-corporate.ts)
 * uretimdeki yoldan cagirir, boylece onizleme ile cikti ayrismaz.
 */

import { useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { registerTurkishFont, setTurkishFont } from "@/lib/pdf-font";
import {
  KURUMSAL,
  corporateFooterHeight,
  corporateHeaderHeight,
  drawCorporateFooterOnAllPages,
  drawCorporateHeader,
} from "@/lib/pdf-corporate";
import type { PaperSettings } from "@/types";

const ORNEK = {
  schoolName: "ONLINE VIP DERSHANE",
  documentKind: "Yazılıya Hazırlık Föyü",
  classSection: "9. SINIF",
  subjectBranch: "FİZİK",
  topicTitle: "Basınç ve Kaldırma Kuvveti",
  footerSlogan: "Olduğunuz yerden, olmak istediğiniz yere.",
};

function ornekAyarlar(ozel: Partial<PaperSettings>): PaperSettings {
  return {
    corporateTemplate: true,
    ...ORNEK,
    ...ozel,
  } as PaperSettings;
}

/** Sablonun ic bilesenleri — gercek icerigin nasil duracagini gostermek icin */
function ornekIcerikCiz(
  doc: jsPDF,
  pageW: number,
  margin: number,
  ustY: number,
  altY: number
) {
  const colGap = 8;
  const colW = (pageW - margin * 2 - colGap) / 2;
  const solX = margin;
  const sagX = margin + colW + colGap;

  // Ortadaki dikey ayirici
  doc.setDrawColor("#9ab2cf");
  doc.setLineWidth(0.3);
  doc.line(pageW / 2, ustY, pageW / 2, altY);

  const bolumBasligi = (x: number, y: number, metin: string) => {
    doc.setFillColor(KURUMSAL.lacivert);
    doc.roundedRect(x, y, colW, 7, 1.8, 1.8, "F");
    doc.setTextColor(KURUMSAL.beyaz);
    setTurkishFont(doc, "bold");
    doc.setFontSize(9);
    doc.text(metin, x + 3, y + 4.8);
    return y + 7 + 4;
  };

  const paragraf = (x: number, y: number, metin: string) => {
    doc.setTextColor("#374151");
    setTurkishFont(doc, "normal");
    doc.setFontSize(8.5);
    const satirlar = doc.splitTextToSize(metin, colW - 2) as string[];
    satirlar.forEach((l, i) => doc.text(l, x, y + i * 4.2));
    return y + satirlar.length * 4.2 + 3;
  };

  const formul = (x: number, y: number, metin: string) => {
    doc.setFillColor("#edf5fb");
    doc.roundedRect(x, y, colW, 13, 2, 2, "F");
    doc.setTextColor(KURUMSAL.lacivert);
    setTurkishFont(doc, "bold");
    doc.setFontSize(14);
    doc.text(metin, x + colW / 2, y + 8.6, { align: "center" });
    return y + 13 + 4;
  };

  const soruBasligi = (x: number, y: number, metin: string) => {
    doc.setFillColor("#dce9f6");
    doc.roundedRect(x, y, colW, 6, 1.6, 1.6, "F");
    doc.setTextColor(KURUMSAL.lacivert);
    setTurkishFont(doc, "bold");
    doc.setFontSize(8);
    doc.text(metin, x + 3, y + 4.1);
    return y + 6 + 3.5;
  };

  const cevapCizgileri = (x: number, y: number, adet: number) => {
    doc.setDrawColor("#d5dfe9");
    doc.setLineWidth(0.25);
    for (let i = 0; i < adet; i++) {
      const ly = y + i * 7;
      doc.line(x, ly, x + colW, ly);
    }
    return y + adet * 7 + 2;
  };

  const kutu = (
    x: number,
    y: number,
    baslik: string,
    metin: string,
    renk: { zemin: string; cerceve: string; yazi: string }
  ) => {
    doc.setFillColor(renk.zemin);
    doc.setDrawColor(renk.cerceve);
    doc.setLineWidth(0.3);
    setTurkishFont(doc, "normal");
    doc.setFontSize(8);
    const satirlar = doc.splitTextToSize(metin, colW - 8) as string[];
    const h = 7 + satirlar.length * 4 + 3;
    doc.roundedRect(x, y, colW, h, 2, 2, "FD");
    doc.setFillColor(renk.cerceve);
    doc.rect(x, y + 1, 1, h - 2, "F");
    doc.setTextColor(renk.yazi);
    setTurkishFont(doc, "bold");
    doc.setFontSize(8);
    doc.text(baslik, x + 3.5, y + 5);
    doc.setTextColor("#374151");
    setTurkishFont(doc, "normal");
    satirlar.forEach((l, i) => doc.text(l, x + 3.5, y + 10 + i * 4));
    return y + h + 4;
  };

  // --- Sol sutun ---
  let y = ustY;
  y = bolumBasligi(solX, y, "KATI BASINCI");
  y = paragraf(
    solX,
    y,
    "Basınç, bir yüzeye dik olarak uygulanan kuvvetin, kuvvetin uygulandığı yüzey alanına oranıdır."
  );
  y = formul(solX, y, "P = F / A");
  y = soruBasligi(solX, y, "ÖRNEK SORU 01");
  y = paragraf(
    solX,
    y,
    "Yüzey alanı yarıya indirilen bir cismin yüzeye uyguladığı basınç nasıl değişir? Açıklayınız."
  );
  y = cevapCizgileri(solX, y, 4);
  kutu(solX, y, "HATIRLATMA", "Kuvvet artarsa basınç artar, yüzey alanı artarsa basınç azalır.", {
    zemin: "#f1f8f4",
    cerceve: "#2e9e63",
    yazi: "#1f7a4a",
  });

  // --- Sag sutun ---
  let y2 = ustY;
  y2 = bolumBasligi(sagX, y2, "SIVI BASINCI");
  // Basit sekil: sivi kabi
  doc.setFillColor("#f5f8fc");
  doc.roundedRect(sagX, y2, colW, 34, 2, 2, "F");
  doc.setDrawColor(KURUMSAL.lacivert);
  doc.setLineWidth(0.8);
  const kx = sagX + colW / 2 - 18;
  doc.line(kx, y2 + 6, kx, y2 + 28);
  doc.line(kx, y2 + 28, kx + 36, y2 + 28);
  doc.line(kx + 36, y2 + 28, kx + 36, y2 + 6);
  doc.setFillColor("#9cdee3");
  doc.rect(kx + 0.5, y2 + 16, 35, 11.6, "F");
  doc.setDrawColor("#4b9ea9");
  doc.setLineWidth(0.4);
  doc.line(kx - 4, y2 + 16, kx + 40, y2 + 16);
  doc.setTextColor(KURUMSAL.lacivert);
  setTurkishFont(doc, "bold");
  doc.setFontSize(8);
  doc.text("h", kx + 19, y2 + 23);
  y2 = y2 + 34 + 4;
  y2 = formul(sagX, y2, "P = h · d · g");
  y2 = soruBasligi(sagX, y2, "ÖRNEK SORU 02");
  y2 = paragraf(
    sagX,
    y2,
    "Sıvı derinliği iki katına çıkarıldığında kabın tabanındaki basınç nasıl değişir?"
  );
  y2 = cevapCizgileri(sagX, y2, 3);
  kutu(
    sagX,
    y2,
    "DİKKAT!",
    "Sıvı basıncı kabın şekline ve sıvının miktarına bağlı değildir; yalnızca derinliğe ve yoğunluğa bağlıdır.",
    { zemin: "#fff1f1", cerceve: "#d72d42", yazi: "#bd2539" }
  );

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

export default function SablonOnizlemePage() {
  const [url, setUrl] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [konu, setKonu] = useState(ORNEK.topicTitle);
  const [metin, setMetin] = useState<string[] | null>(null);

  const uret = useCallback(async () => {
    try {
      setHata(null);
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      await registerTurkishFont(doc);
      const settings = ornekAyarlar({ topicTitle: konu });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;

      drawCorporateHeader(doc, settings, pageW, margin);
      const ustY = corporateHeaderHeight(settings);
      const altY = pageH - margin - corporateFooterHeight();
      ornekIcerikCiz(doc, pageW, margin, ustY, altY);
      drawCorporateFooterOnAllPages(doc, settings, pageW, pageH, margin);

      const blob = doc.output("blob");

      // Metin gercekten secilebilir mi? PDF'ten geri okuyarak dogruluyoruz.
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const buf = await blob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const sayfa = await pdf.getPage(1);
        const icerik = await sayfa.getTextContent();
        setMetin(
          icerik.items
            .map((it) => ("str" in it ? it.str : ""))
            .filter((t) => t.trim())
        );
      } catch {
        setMetin(null);
      }
      setUrl((eski) => {
        if (eski) URL.revokeObjectURL(eski);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    }
  }, [konu]);

  useEffect(() => {
    void uret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-bold text-slate-800">
          Kurumsal föy şablonu — PDF çıktısı
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Üretimdeki çizim fonksiyonlarının gerçek çıktısı. Konu bandını boş
          bırakırsanız bant çizilmez ve içerik yukarı kayar.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={konu}
            onChange={(e) => setKonu(e.target.value)}
            placeholder="Konu başlığı (boş bırakılabilir)"
            className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void uret()}
            className="rounded-lg bg-[#173b70] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2a52]"
          >
            Yeniden üret
          </button>
        </div>

        {hata && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{hata}</p>
        )}

        {metin && (
          <details className="mt-4 rounded-lg border border-slate-300 bg-white p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-700">
              PDF&apos;ten geri okunan metin ({metin.length} parça) — seçilebilirlik denetimi
            </summary>
            <p className="mt-2 break-words text-slate-600" data-test="pdf-metin">
              {metin.join(" | ")}
            </p>
          </details>
        )}

        {url && (
          <iframe
            src={url}
            title="Kurumsal şablon PDF"
            className="mt-4 h-[1000px] w-full rounded-xl border border-slate-300 bg-white"
          />
        )}
      </div>
    </main>
  );
}
