import { jsPDF } from "jspdf";
import type { OpticalFormPlacement, PaperSettings, Question } from "@/types";
import { renderQuestionToDataUrl } from "./question-render";
import { registerTurkishFont, setTurkishFont } from "./pdf-font";
import {
  columnContentWidth,
  fitImageInBox,
  layoutHintsForColumns,
  resolveLayoutSpan,
} from "./pdf-layout";
import {
  drawBuiltInOpticalForm,
  drawCustomOpticalForm,
  estimateOpticalFormHeight,
} from "./pdf-optical-form";

const MM_PER_CM = 10;
const A4 = { w: 210, h: 297 };
const COL_GAP = 6;
const NUM_WIDTH = 8;
const NUM_BLOCK_H = 10;

function pageDims(settings: PaperSettings) {
  const base = settings.paperSize === "A4" ? A4 : { w: 297, h: 420 };
  if (settings.orientation === "landscape") {
    return { w: base.h, h: base.w };
  }
  return base;
}

function resolveOpticalPlacement(settings: PaperSettings): OpticalFormPlacement {
  const p = settings.opticalPlacement ?? "bottom";
  if (p === "sidebar") return "bottom";
  return p;
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
  colW: number,
  contentBottom: number
) {
  if (!settings.columnDivider || settings.columns < 2) return;
  const cols = settings.columns;
  const y0 = margin + headerH;
  const y1 = contentBottom;
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
  const opticalPlacement = resolveOpticalPlacement(settings);
  const opticalSidebar =
    settings.includeOpticalForm && settings.opticalPlacement === "sidebar";
  const questionCols = opticalSidebar ? Math.max(1, cols - 1) : cols;
  const strictColumnFit = settings.strictColumnFit !== false;
  const scale =
    Math.min(100, Math.max(50, settings.questionScalePercent ?? 92)) / 100;
  const layoutHints = layoutHintsForColumns(questionCols, strictColumnFit);
  const headerH = 34;
  const usableW = pageW - margin * 2;
  const colW = (usableW - COL_GAP * (cols - 1)) / cols;
  const startY = margin + headerH;
  const bottomLimit = pageH - margin;
  const spacing = settings.spacingBetweenQuestions ? 10 : 5;
  const colInnerW = columnContentWidth(colW, COL_GAP, 1, NUM_WIDTH);
  const pageInnerW = columnContentWidth(
    colW,
    COL_GAP,
    questionCols,
    NUM_WIDTH
  );

  const opticalReserve =
    settings.includeOpticalForm && opticalPlacement === "bottom"
      ? estimateOpticalFormHeight(
          questions.length,
          settings,
          usableW,
          "horizontal"
        ) + 10
      : 0;
  const questionBottom = () => bottomLimit - opticalReserve;

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

  const paintOpticalSidebar = async () => {
    if (!opticalSidebar) return;
    const opticCol = cols - 1;
    const ox = colX(margin, colW, opticCol);
    const area = {
      x: ox + 1,
      y: startY,
      w: colW - 2,
      h: bottomLimit - startY,
    };
    if (settings.opticalCustomImage) {
      await drawCustomOpticalForm(doc, settings.opticalCustomImage, area);
    } else {
      drawBuiltInOpticalForm(doc, settings, area, questions.length, "vertical");
    }
  };

  const paintPageChrome = async (contentBottom = bottomLimit) => {
    drawHeader(doc, settings, pageW, margin);
    drawWatermark(doc, settings, pageW, pageH);
    drawColumnDividers(
      doc,
      settings,
      pageW,
      pageH,
      margin,
      headerH,
      colW,
      contentBottom
    );
    await paintOpticalSidebar();
  };

  const newPage = async () => {
    doc.addPage();
    await paintPageChrome();
    col = 0;
    x = colX(margin, colW, 0);
    y = startY;
  };

  const beginFullWidthRow = async () => {
    if (col !== 0) {
      await newPage();
      return;
    }
    if (y > startY + 2) {
      const minFullH = 40;
      if (y + minFullH > questionBottom()) await newPage();
    }
    col = 0;
    x = margin;
  };

  await paintPageChrome();

  const rendered = await Promise.all(
    questions.map((q) => renderQuestionToDataUrl(q))
  );

  for (let i = 0; i < questions.length; i++) {
    qNum++;
    const q = questions[i];
    const img = await loadImage(rendered[i]);
    let placed = false;

    while (!placed) {
      const qBottom = questionBottom();
      const remainingH = qBottom - y - spacing - NUM_BLOCK_H;

      let spanCols = 1;
      if (q.layoutSpan === "full") {
        spanCols = questionCols;
      } else if (q.layoutSpan === "column") {
        spanCols = 1;
      } else if (settings.smartPlacement) {
        spanCols = resolveLayoutSpan(
          q,
          img,
          questionCols,
          colInnerW * scale,
          pageInnerW * scale,
          Math.max(remainingH, 40),
          strictColumnFit
        );
      }

      const isFull = spanCols >= questionCols;

      if (isFull) await beginFullWidthRow();

      const maxW =
        columnContentWidth(
          colW,
          COL_GAP,
          isFull ? questionCols : 1,
          NUM_WIDTH
        ) * scale;
      let maxH = Math.max(
        layoutHints.minHeightMm,
        qBottom - y - spacing - NUM_BLOCK_H
      );

      let { w: imgW, h: imgH } = fitImageInBox(
        img,
        maxW,
        maxH,
        layoutHints.minFillRatio,
        layoutHints.strict
      );
      let blockH = imgH + spacing + NUM_BLOCK_H;

      while (y + blockH > qBottom && maxH > layoutHints.minHeightMm) {
        maxH = Math.max(layoutHints.minHeightMm, maxH * 0.85);
        ({ w: imgW, h: imgH } = fitImageInBox(img, maxW, maxH, 0, true));
        blockH = imgH + spacing + NUM_BLOCK_H;
      }

      if (!isFull && y + blockH > qBottom) {
        if (col < questionCols - 1) {
          col++;
          x = colX(margin, colW, col);
          y = startY;
          continue;
        }
        await newPage();
        continue;
      }
      if (isFull && y + blockH > qBottom) {
        await newPage();
        continue;
      }

      const drawX = isFull ? margin : x;
      const drawImgX = drawX + NUM_WIDTH;

      setTurkishFont(doc, "bold");
      doc.setFontSize(11);
      doc.text(`${qNum}.`, drawX + 1, y + 6);

      const imgY = y + 4;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.15);
      doc.rect(drawImgX - 0.5, imgY - 0.5, imgW + 1, imgH + 1);

      doc.addImage(
        rendered[i],
        "PNG",
        drawImgX,
        imgY,
        imgW,
        imgH,
        undefined,
        "SLOW"
      );

      y += blockH;

      if (isFull) {
        col = 0;
        x = colX(margin, colW, 0);
      }
      placed = true;
    }
  }

  const drawOpticalAtBottom = async () => {
    const optH = settings.opticalCustomImage
      ? Math.min(70, estimateOpticalFormHeight(questions.length, settings, usableW))
      : estimateOpticalFormHeight(questions.length, settings, usableW, "horizontal");
    const gap = 6;
    let optY = bottomLimit - optH;

    if (y + gap > optY) {
      doc.addPage();
      await paintPageChrome();
      optY = bottomLimit - optH;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.25);
    doc.line(margin, optY - 3, margin + usableW, optY - 3);

    const area = { x: margin, y: optY, w: usableW, h: optH };
    if (settings.opticalCustomImage) {
      await drawCustomOpticalForm(doc, settings.opticalCustomImage, area);
    } else {
      drawBuiltInOpticalForm(
        doc,
        settings,
        area,
        questions.length,
        "horizontal"
      );
    }
  };

  if (settings.includeOpticalForm) {
    if (opticalPlacement === "bottom") {
      await drawOpticalAtBottom();
    } else if (opticalPlacement === "separate") {
      doc.addPage();
      await paintPageChrome();
      const area = {
        x: margin,
        y: startY,
        w: usableW,
        h: bottomLimit - startY,
      };
      if (settings.opticalCustomImage) {
        await drawCustomOpticalForm(doc, settings.opticalCustomImage, area);
      } else {
        drawBuiltInOpticalForm(
          doc,
          settings,
          area,
          questions.length,
          "horizontal"
        );
      }
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
