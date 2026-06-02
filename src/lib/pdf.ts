import { jsPDF } from "jspdf";
import type { PaperSettings, Question } from "@/types";

const MM_PER_CM = 10;
const A4 = { w: 210, h: 297 };

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
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(settings.schoolName || "Dershanem", margin, 12);
  doc.setFontSize(11);
  doc.text(settings.testName || "Sınav Kağıdı", margin, 20);
  doc.setFontSize(9);
  const meta = [
    settings.examType,
    settings.classSection,
    settings.group !== "Grup Yok" ? settings.group : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) doc.text(meta, margin, 25);
  if (settings.includeTeacherName && settings.teacherName) {
    doc.text(`Öğretmen: ${settings.teacherName}`, pageW - margin, 20, {
      align: "right",
    });
  }
  doc.setTextColor(0, 0, 0);
}

export async function generateTestPdf(
  questions: Question[],
  settings: PaperSettings
): Promise<Blob> {
  const { w: pageW, h: pageH } = pageDims(settings);
  const margin = settings.marginCm * MM_PER_CM;
  const cols = settings.columns;
  const colGap = 8;
  const headerH = 32;
  const usableW = pageW - margin * 2;
  const colW = (usableW - colGap * (cols - 1)) / cols;
  const startY = margin + headerH;
  const bottomLimit = pageH - margin;

  const doc = new jsPDF({
    orientation: settings.orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: settings.paperSize.toLowerCase() as "a4" | "a3",
  });

  let col = 0;
  let x = margin;
  let y = startY;
  let qNum = 0;

  const newPage = () => {
    doc.addPage();
    drawHeader(doc, settings, pageW, margin);
    col = 0;
    x = margin;
    y = startY;
  };

  drawHeader(doc, settings, pageW, margin);

  if (settings.watermark) {
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(48);
    doc.text("Dershanem VIP", pageW / 2, pageH / 2, {
      align: "center",
      angle: 35,
    });
    doc.setTextColor(0, 0, 0);
  }

  for (const question of questions) {
    qNum++;
    const img = await loadImage(question.imageDataUrl);
    const maxImgW = colW - 4;
    const ratio = img.height / img.width;
    let imgW = maxImgW;
    let imgH = imgW * ratio;
    const maxImgH = settings.smartPlacement ? 85 : 120;
    if (imgH > maxImgH) {
      imgH = maxImgH;
      imgW = imgH / ratio;
    }

    const blockH =
      imgH + (settings.spacingBetweenQuestions ? 14 : 8) + 8;

    if (y + blockH > bottomLimit) {
      if (col < cols - 1) {
        col++;
        x = margin + col * (colW + colGap);
        y = startY;
      } else {
        newPage();
      }
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${qNum}.`, x, y + 5);
    doc.addImage(
      question.imageDataUrl,
      "PNG",
      x + 8,
      y + 8,
      imgW,
      imgH,
      undefined,
      "FAST"
    );
    y += blockH;
  }

  if (settings.includeOpticalForm) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Optik Cevap Formu", margin, margin + 10);
    doc.setFontSize(10);
    doc.text(
      `${settings.testName} — ${questions.length} soru`,
      margin,
      margin + 18
    );
    const startOpticY = margin + 28;
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
