import { jsPDF } from "jspdf";
import type { PaperSettings, Question } from "@/types";
import { renderQuestionToDataUrl } from "./question-render";
import { registerTurkishFont, setTurkishFont } from "./pdf-font";

const MM_PER_CM = 10;
const A4 = { w: 210, h: 297 };
const COL_GAP = 6;
const NUM_WIDTH = 8;

function pageDims(settings: PaperSettings) {
  const base = settings.paperSize === "A4" ? A4 : { w: 297, h: 420 };
  if (settings.orientation === "landscape") {
    return { w: base.h, h: base.w };
  }
  return base;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function drawHeader(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  margin: number
) {
  const theme = settings.themeColor;
  doc.setFillColor(theme);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  setTurkishFont(doc, "bold");
  doc.setFontSize(14);
  doc.text(settings.schoolName || "Dershanem", margin, 13);
  doc.setFontSize(11);
  setTurkishFont(doc, "normal");
  doc.text(settings.testName || "Sınav Kağıdı", margin, 21);
  doc.setFontSize(9);
  const meta = [
    settings.examType,
    settings.classSection,
    settings.group !== "Grup Yok" ? settings.group : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) doc.text(meta, margin, 27);
  if (settings.includeTeacherName && settings.teacherName) {
    doc.text(`Öğretmen: ${settings.teacherName}`, pageW - margin, 21, {
      align: "right",
    });
  }
  doc.setTextColor(0, 0, 0);
}

function drawWatermark(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number
) {
  if (!settings.watermark) return;
  const text = settings.watermarkText || "Dershanem";
  const alpha = Math.min(0.35, Math.max(0.05, settings.watermarkOpacity));
  const gray = Math.round(255 * (1 - alpha));
  doc.setTextColor(gray, gray, gray);
  setTurkishFont(doc, "bold");
  doc.setFontSize(38);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      doc.text(
        text,
        (pageW / 3) * (col + 0.5),
        (pageH / 4) * (row + 0.8),
        { align: "center", angle: 32 }
      );
    }
  }
  doc.setTextColor(0, 0, 0);
}

function drawColumnDividers(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number,
  margin: number,
  headerH: number,
  colW: number
) {
  if (!settings.columnDivider || settings.columns < 2) return;
  const cols = settings.columns;
  const y0 = margin + headerH;
  const y1 = pageH - margin;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.55);
  for (let i = 1; i < cols; i++) {
    const x = margin + i * colW + (i - 0.5) * COL_GAP;
    doc.line(x, y0, x, y1);
    doc.setLineWidth(0.2);
    doc.setDrawColor(200, 200, 200);
    doc.line(x + 0.3, y0, x + 0.3, y1);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.55);
  }
}

function colX(margin: number, colW: number, col: number) {
  return margin + col * (colW + COL_GAP);
}

export async function generateTestPdf(
  questions: Question[],
  settings: PaperSettings
): Promise<Blob> {
  const { w: pageW, h: pageH } = pageDims(settings);
  const margin = settings.marginCm * MM_PER_CM;
  const cols = settings.columns;
  const headerH = 34;
  const usableW = pageW - margin * 2;
  const colW = (usableW - COL_GAP * (cols - 1)) / cols;
  const startY = margin + headerH;
  const bottomLimit = pageH - margin;
  const spacing = settings.spacingBetweenQuestions ? 10 : 5;

  const doc = new jsPDF({
    orientation: settings.orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: settings.paperSize.toLowerCase() as "a4" | "a3",
    compress: true,
  });

  await registerTurkishFont(doc);

  let col = 0;
  let x = colX(margin, colW, 0);
  let y = startY;
  let qNum = 0;

  const paintPageChrome = () => {
    drawHeader(doc, settings, pageW, margin);
    drawWatermark(doc, settings, pageW, pageH);
    drawColumnDividers(doc, settings, pageW, pageH, margin, headerH, colW);
  };

  const newPage = () => {
    doc.addPage();
    paintPageChrome();
    col = 0;
    x = colX(margin, colW, 0);
    y = startY;
  };

  paintPageChrome();

  const rendered = await Promise.all(
    questions.map((q) => renderQuestionToDataUrl(q))
  );

  for (let i = 0; i < questions.length; i++) {
    qNum++;
    const img = await loadImage(rendered[i]);
    const pad = 2;
    const maxImgW = colW - NUM_WIDTH - pad * 2;
    const ratio = img.height / img.width;
    let imgW = maxImgW;
    let imgH = imgW * ratio;
    const maxImgH = settings.smartPlacement
      ? Math.max(50, (bottomLimit - startY) / Math.ceil(questions.length / cols) - spacing - 12)
      : Math.max(70, 250 / cols);

    if (imgH > maxImgH) {
      imgH = maxImgH;
      imgW = imgH / ratio;
    }

    const blockH = imgH + spacing + 10;

    if (y + blockH > bottomLimit) {
      if (col < cols - 1) {
        col++;
        x = colX(margin, colW, col);
        y = startY;
      } else {
        newPage();
      }
    }

    setTurkishFont(doc, "bold");
    doc.setFontSize(11);
    doc.text(`${qNum}.`, x + 1, y + 6);

    const imgX = x + NUM_WIDTH;
    const imgY = y + 4;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.15);
    doc.rect(imgX - 0.5, imgY - 0.5, imgW + 1, imgH + 1);

    doc.addImage(
      rendered[i],
      "PNG",
      imgX,
      imgY,
      imgW,
      imgH,
      undefined,
      "SLOW"
    );

    y += blockH;
  }

  if (settings.includeOpticalForm) {
    doc.addPage();
    paintPageChrome();
    setTurkishFont(doc, "bold");
    doc.setFontSize(16);
    doc.text("Optik Cevap Formu", margin, margin + 12);
    setTurkishFont(doc, "normal");
    doc.setFontSize(10);
    doc.text(
      `${settings.testName || "Test"} — ${questions.length} soru`,
      margin,
      margin + 20
    );
    const startOpticY = margin + 30;
    for (let i = 1; i <= questions.length; i++) {
      const row = Math.floor((i - 1) / 5);
      const colIdx = (i - 1) % 5;
      const ox = margin + colIdx * 38;
      const oy = startOpticY + row * 12;
      doc.text(`${i}.`, ox, oy);
      ["A", "B", "C", "D", "E"].forEach((opt, j) => {
        doc.circle(ox + 8 + j * 5, oy - 1.5, 1.2);
        doc.setFontSize(7);
        doc.text(opt, ox + 7 + j * 5, oy + 0.5, { align: "center" });
      });
    }
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
