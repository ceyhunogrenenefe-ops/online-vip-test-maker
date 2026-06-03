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
import { packQuestionsForSmartPdf } from "./pdf-pack";
import {
  drawBuiltInOpticalForm,
  drawCustomOpticalForm,
  estimateOpticalFormHeight,
} from "./pdf-optical-form";
import {
  drawPageWatermark,
  type PageObstacle,
} from "./pdf-watermark";
import {
  buildUniformSizingPlan,
  fitQuestionForPdf,
  resolveUniformSpanCols,
} from "./pdf-uniform-size";

const MM_PER_CM = 10;
const A4 = { w: 210, h: 297 };
const A3 = { w: 297, h: 420 };
const COL_GAP = 6;
const NUM_WIDTH = 8;
const NUM_BLOCK_H = 10;

function pageDims(settings: PaperSettings) {
  let base: { w: number; h: number };
  if (settings.paperSize === "custom") {
    base = {
      w: Math.min(600, Math.max(80, settings.customPaperWidthMm ?? 210)),
      h: Math.min(900, Math.max(80, settings.customPaperHeightMm ?? 297)),
    };
  } else if (settings.paperSize === "A3") {
    base = A3;
  } else {
    base = A4;
  }
  if (settings.orientation === "landscape") {
    return { w: base.h, h: base.w };
  }
  return base;
}

function questionSpacingMm(settings: PaperSettings, smartPack: boolean): number {
  if (!settings.spacingBetweenQuestions) {
    return smartPack ? 3 : 5;
  }
  const mm = settings.questionSpacingMm ?? 10;
  return Math.min(100, Math.max(0, mm));
}

function headerBarHeight(settings: PaperSettings): number {
  const base = 30;
  if (
    (settings.paperType === "yaprak" || settings.paperType === "deneme") &&
    settings.testDescription?.trim()
  ) {
    const lineCount = Math.min(
      5,
      settings.testDescription.split("\n").filter((l) => l.trim()).length
    );
    return base + Math.max(0, lineCount - 1) * 3.5;
  }
  return base;
}

function contentHeaderGap(settings: PaperSettings): number {
  return headerBarHeight(settings) + 4;
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
  const barH = headerBarHeight(settings);
  doc.setFillColor(theme);
  doc.rect(0, 0, pageW, barH, "F");
  doc.setTextColor(255, 255, 255);
  setTurkishFont(doc, "bold");
  doc.setFontSize(14);
  doc.text(settings.schoolName || "Dershanem", margin, 13);
  doc.setFontSize(11);
  setTurkishFont(doc, "normal");
  doc.text(settings.testName || "Sınav Kağıdı", margin, 21);
  setTurkishFont(doc, "normal");
  doc.setFontSize(9);

  const isProfilePaper =
    settings.paperType === "yaprak" || settings.paperType === "deneme";

  if (isProfilePaper && settings.testDescription?.trim()) {
    const descLines = doc.splitTextToSize(
      settings.testDescription.trim(),
      pageW - margin * 2 - 40
    );
    const maxLines = Math.min(5, descLines.length);
    for (let i = 0; i < maxLines; i++) {
      doc.text(descLines[i], margin, 27 + i * 3.5);
    }
  } else if (!isProfilePaper) {
    const meta = [
      settings.examType,
      settings.classSection,
      settings.group !== "Grup Yok" ? settings.group : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) doc.text(meta, margin, 27);
  }

  const profileMeta = [
    settings.classSection,
    settings.group !== "Grup Yok" ? settings.group : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (isProfilePaper && profileMeta) {
    doc.text(profileMeta, pageW - margin, barH - 2, { align: "right" });
  }

  if (settings.includeTeacherName && settings.teacherName) {
    doc.text(`Öğretmen: ${settings.teacherName}`, pageW - margin, 21, {
      align: "right",
    });
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
  const smartPack = settings.smartPlacement;
  const strictColumnFit = settings.strictColumnFit !== false;
  const uniformSizing = settings.uniformQuestionSize !== false;
  const scale =
    Math.min(100, Math.max(50, settings.questionScalePercent ?? 92)) / 100;
  const layoutHints = layoutHintsForColumns(
    questionCols,
    strictColumnFit,
    smartPack
  );
  const headerH = contentHeaderGap(settings);
  const usableW = pageW - margin * 2;
  const colW = (usableW - COL_GAP * (cols - 1)) / cols;
  const startY = margin + headerH;
  const bottomLimit = pageH - margin;
  const spacing = questionSpacingMm(settings, smartPack);
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
    format:
      settings.paperSize === "custom"
        ? [pageW, pageH]
        : (settings.paperSize.toLowerCase() as "a4" | "a3"),
    compress: true,
  });

  await registerTurkishFont(doc);

  let col = 0;
  let x = colX(margin, colW, 0);
  let y = startY;
  let qNum = 0;
  const pageObstacles: PageObstacle[][] = [];
  const watermarkedPages = new Set<number>();

  const currentPageIndex = () => doc.getNumberOfPages() - 1;

  const ensureObstacleList = (pageIdx: number) => {
    while (pageObstacles.length <= pageIdx) pageObstacles.push([]);
  };

  const addObstacle = (rect: PageObstacle) => {
    const idx = currentPageIndex();
    ensureObstacleList(idx);
    pageObstacles[idx].push(rect);
  };

  const watermarkContentBottom = () => questionBottom();

  const finishPageWatermark = async () => {
    if (!settings.watermark) return;
    const pageIdx = currentPageIndex();
    if (watermarkedPages.has(pageIdx)) return;
    watermarkedPages.add(pageIdx);
    ensureObstacleList(pageIdx);
    await drawPageWatermark(doc, settings, pageW, pageH, {
      pageNumber: pageIdx + 1,
      obstacles: pageObstacles[pageIdx],
      margin,
      contentTop: startY,
      contentBottom: watermarkContentBottom(),
    });
  };

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
    addObstacle({ x: 0, y: 0, w: pageW, h: startY });
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
    await finishPageWatermark();
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

  const packParams = {
    questionCols,
    colInnerW,
    pageInnerW,
    scale,
    pageContentH: bottomLimit - startY - opticalReserve,
    spacing,
    numBlockH: NUM_BLOCK_H,
  };

  const layoutQuestions = smartPack
    ? await packQuestionsForSmartPdf(questions, packParams)
    : questions;

  const renderedEntries = await Promise.all(
    questions.map(async (q) => ({
      id: q.id,
      url: await renderQuestionToDataUrl(q),
    }))
  );
  const renderedById = new Map(
    renderedEntries.map((e) => [e.id, e.url] as const)
  );

  const pageContentH = bottomLimit - startY - opticalReserve;
  const uniformPlan = uniformSizing
    ? await buildUniformSizingPlan(
        layoutQuestions,
        renderedById,
        colInnerW,
        pageInnerW,
        scale,
        pageContentH
      )
    : null;

  for (let i = 0; i < layoutQuestions.length; i++) {
    qNum++;
    const q = layoutQuestions[i];
    const img = await loadImage(renderedById.get(q.id)!);
    let placed = false;

    while (!placed) {
      const qBottom = questionBottom();
      const remainingH = qBottom - y - spacing - NUM_BLOCK_H;

      let spanCols = 1;
      if (q.layoutSpan === "full") {
        spanCols = questionCols;
      } else if (q.layoutSpan === "column") {
        spanCols = 1;
      } else if (uniformPlan) {
        spanCols = resolveUniformSpanCols(
          q,
          img.height / img.width,
          questionCols,
          uniformPlan.colMaxH,
          uniformPlan.colWidth
        );
      } else if (smartPack) {
        spanCols = resolveLayoutSpan(
          q,
          img,
          questionCols,
          colInnerW * scale,
          pageInnerW * scale,
          Math.max(remainingH, 40),
          strictColumnFit,
          true
        );
      }

      const isFull = spanCols >= questionCols;

      if (isFull) await beginFullWidthRow();

      let imgW: number;
      let imgH: number;
      let blockH: number;

      if (uniformPlan) {
        const fitted = fitQuestionForPdf(
          img,
          uniformPlan,
          isFull,
          Math.max(layoutHints.minHeightMm, remainingH)
        );
        if (!fitted) {
          if (!isFull && col < questionCols - 1) {
            col++;
            x = colX(margin, colW, col);
            y = startY;
            continue;
          }
          await newPage();
          continue;
        }
        imgW = fitted.w;
        imgH = fitted.h;
        blockH = imgH + spacing + NUM_BLOCK_H;
      } else {
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

        ({ w: imgW, h: imgH } = fitImageInBox(
          img,
          maxW,
          maxH,
          layoutHints.minFillRatio,
          layoutHints.strict
        ));
        blockH = imgH + spacing + NUM_BLOCK_H;

        while (y + blockH > qBottom && maxH > layoutHints.minHeightMm) {
          maxH = Math.max(layoutHints.minHeightMm, maxH * 0.85);
          ({ w: imgW, h: imgH } = fitImageInBox(img, maxW, maxH, 0, true));
          blockH = imgH + spacing + NUM_BLOCK_H;
        }
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
        renderedById.get(q.id)!,
        "PNG",
        drawImgX,
        imgY,
        imgW,
        imgH,
        undefined,
        "SLOW"
      );

      const blockW = isFull
        ? pageInnerW + NUM_WIDTH
        : colW - 1;
      addObstacle({
        x: drawX,
        y: y,
        w: blockW,
        h: blockH,
      });

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

  await finishPageWatermark();

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
      await finishPageWatermark();
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
