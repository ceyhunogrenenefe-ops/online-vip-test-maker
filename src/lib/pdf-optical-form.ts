import type { jsPDF } from "jspdf";
import type { OpticalFormChoiceCount, PaperSettings } from "@/types";
import { setTurkishFont } from "./pdf-font";

const OPTION_LABELS: Record<OpticalFormChoiceCount, string[]> = {
  3: ["A", "B", "C"],
  4: ["A", "B", "C", "D"],
  5: ["A", "B", "C", "D", "E"],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [37, 99, 235];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function defaultFormId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `100${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}`;
}

export function resolveFormId(settings: PaperSettings): string {
  return settings.opticalFormId?.trim() || defaultFormId();
}

function drawFiducial(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number
) {
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - size / 2, cy - size / 2, size, size, "F");
}

export type OpticalFormLayout = "vertical" | "horizontal";

/** Sayfa altı için tahmini yükseklik (mm) */
export function estimateOpticalFormHeight(
  questionCount: number,
  settings: PaperSettings,
  areaWidth: number,
  layout: OpticalFormLayout = "horizontal"
): number {
  const choices = settings.opticalChoiceCount ?? 5;
  if (layout === "vertical") {
    const rowH = 7.2;
    const maxRows = Math.max(8, Math.floor(80 / rowH));
    const cols = Math.max(1, Math.ceil(questionCount / maxRows));
    return 58 + Math.min(questionCount, maxRows) * rowH + (cols > 1 ? 4 : 0);
  }
  const slotW = 7 + choices * 5.2;
  const perRow = Math.max(1, Math.floor((areaWidth - 24) / slotW));
  const rows = Math.ceil(questionCount / perRow);
  return 48 + rows * 8.5;
}

/** OMR optik form — vertical: dar sütun, horizontal: sayfa altı */
export function drawBuiltInOpticalForm(
  doc: jsPDF,
  settings: PaperSettings,
  area: { x: number; y: number; w: number; h: number },
  questionCount: number,
  layout: OpticalFormLayout = "vertical"
) {
  if (layout === "horizontal") {
    drawBuiltInOpticalFormHorizontal(
      doc,
      settings,
      area,
      questionCount
    );
    return;
  }
  const [r, g, b] = hexToRgb(settings.themeColor);
  const choices = settings.opticalChoiceCount ?? 5;
  const labels = OPTION_LABELS[choices];
  const formId = resolveFormId(settings);
  const pad = 3;
  const x0 = area.x + pad;
  const y0 = area.y + pad;
  const w = area.w - pad * 2;
  const h = area.h - pad * 2;

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.6);
  doc.roundedRect(area.x, area.y, area.w, area.h, 2, 2);

  const headerH = 14;
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.45);
  doc.roundedRect(x0, y0, w, headerH, 1.5, 1.5);

  const pillText =
    settings.classSection?.trim() ||
    settings.group !== "Grup Yok"
      ? settings.group
      : settings.testName?.slice(0, 12) || "SINAV";

  doc.setFillColor(r, g, b);
  const pillW = Math.min(w - 8, doc.getTextWidth(pillText) + 10);
  doc.roundedRect(x0 + 3, y0 + 3, pillW, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  setTurkishFont(doc, "bold");
  doc.setFontSize(8);
  doc.text(pillText.toUpperCase(), x0 + 3 + pillW / 2, y0 + 8.2, {
    align: "center",
  });

  doc.setTextColor(0, 0, 0);
  setTurkishFont(doc, "normal");
  doc.setFontSize(7);
  const sub = settings.testName || settings.examType || "";
  if (sub) {
    doc.text(sub.slice(0, 42), x0 + 3, y0 + headerH - 2);
  }

  let cy = y0 + headerH + 5;
  setTurkishFont(doc, "bold");
  doc.setFontSize(9);
  doc.text("Ad - Soyad", x0 + 2, cy);
  cy += 3;
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.35);
  doc.rect(x0 + 2, cy, w - 4, 7);
  cy += 12;

  const gridTop = cy + 5;
  const markerSize = 3.2;
  const gridLeft = x0 + 6;
  const gridRight = x0 + w - 10;
  const gridBottom = y0 + h - 8;

  drawFiducial(doc, gridLeft, gridTop, markerSize);
  drawFiducial(doc, (gridLeft + gridRight) / 2, gridTop, markerSize);
  drawFiducial(doc, gridRight, gridTop, markerSize);
  drawFiducial(doc, gridLeft, gridBottom, markerSize);
  drawFiducial(doc, (gridLeft + gridRight) / 2, gridBottom, markerSize);
  drawFiducial(doc, gridRight, gridBottom, markerSize);

  const bubbleR = 1.55;
  const numColW = 6;
  const labelRowH = 6;
  const rowH = 7.2;
  const gridW = gridRight - gridLeft - 4;
  const headerY = gridTop + 5;

  setTurkishFont(doc, "bold");
  doc.setFontSize(7);
  const labelSpan = (gridW - numColW) / labels.length;
  labels.forEach((lab, i) => {
    const bx = gridLeft + numColW + labelSpan * (i + 0.5);
    doc.text(lab, bx, headerY, { align: "center" });
  });

  const gridInnerH = gridBottom - headerY - 4;
  const maxRowsPerCol = Math.max(1, Math.floor(gridInnerH / rowH));
  const bubbleCols = Math.max(1, Math.ceil(questionCount / maxRowsPerCol));
  const colBlockW = (gridW - numColW) / bubbleCols;

  setTurkishFont(doc, "normal");
  doc.setFontSize(8);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.2);

  for (let q = 1; q <= questionCount; q++) {
    const block = q - 1;
    const bCol = Math.floor(block / maxRowsPerCol);
    const bRow = block % maxRowsPerCol;
    const colStartX = gridLeft + bCol * colBlockW;
    const oy = headerY + 4 + bRow * rowH;

    doc.text(String(q), colStartX + 2, oy + 1.5);
    labels.forEach((_, j) => {
      const bx =
        colStartX + numColW + (colBlockW / labels.length) * (j + 0.5);
      doc.circle(bx, oy, bubbleR);
    });
  }

  setTurkishFont(doc, "normal");
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  const idText = `Form ID: ${formId}`;
  doc.text(idText, x0 + w - 1, y0 + h / 2, {
    angle: 90,
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
}

function drawBuiltInOpticalFormHorizontal(
  doc: jsPDF,
  settings: PaperSettings,
  area: { x: number; y: number; w: number; h: number },
  questionCount: number
) {
  const [r, g, b] = hexToRgb(settings.themeColor);
  const choices = settings.opticalChoiceCount ?? 5;
  const labels = OPTION_LABELS[choices];
  const formId = resolveFormId(settings);
  const pad = 3;
  const x0 = area.x + pad;
  const y0 = area.y + pad;
  const w = area.w - pad * 2;
  const h = area.h - pad * 2;

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.55);
  doc.roundedRect(area.x, area.y, area.w, area.h, 2, 2);

  const pillText =
    settings.classSection?.trim() ||
    (settings.group !== "Grup Yok" ? settings.group : "") ||
    settings.testName?.slice(0, 14) ||
    "SINAV";

  doc.setFillColor(r, g, b);
  const pillW = Math.min(42, doc.getTextWidth(pillText) + 12);
  doc.roundedRect(x0 + 2, y0 + 2, pillW, 7, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  setTurkishFont(doc, "bold");
  doc.setFontSize(7.5);
  doc.text(pillText.toUpperCase(), x0 + 2 + pillW / 2, y0 + 6.5, {
    align: "center",
  });

  setTurkishFont(doc, "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("Ad - Soyad", x0 + pillW + 8, y0 + 6);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.3);
  doc.rect(x0 + pillW + 28, y0 + 3.5, w - pillW - 52, 6);

  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text(`Form ID: ${formId}`, x0 + w - 2, y0 + 6, { align: "right" });
  doc.setTextColor(0, 0, 0);

  const gridTop = y0 + 14;
  const gridBottom = y0 + h - 4;
  const gridLeft = x0 + 4;
  const gridRight = x0 + w - 4;
  const markerSize = 2.8;

  drawFiducial(doc, gridLeft, gridTop, markerSize);
  drawFiducial(doc, gridRight, gridTop, markerSize);
  drawFiducial(doc, gridLeft, gridBottom, markerSize);
  drawFiducial(doc, gridRight, gridBottom, markerSize);

  const bubbleR = 1.65;
  const rowH = 7.5;
  const numW = 5;
  const slotW = numW + labels.length * 5.2;
  const perRow = Math.max(1, Math.floor((gridRight - gridLeft - 8) / slotW));
  const headerY = gridTop + 4;

  setTurkishFont(doc, "bold");
  doc.setFontSize(6.5);
  labels.forEach((lab, j) => {
    doc.text(lab, gridLeft + numW + 5.2 * (j + 0.5), headerY, {
      align: "center",
    });
  });

  setTurkishFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.setDrawColor(50, 50, 50);

  for (let q = 1; q <= questionCount; q++) {
    const idx = q - 1;
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    const ox = gridLeft + col * slotW;
    const oy = headerY + 5 + row * rowH;

    doc.text(String(q), ox + 1.5, oy + 1.2);
    labels.forEach((_, j) => {
      doc.circle(ox + numW + 5.2 * (j + 0.5), oy, bubbleR);
    });
  }
}

export async function drawCustomOpticalForm(
  doc: jsPDF,
  dataUrl: string,
  area: { x: number; y: number; w: number; h: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      let w = area.w - 4;
      let h = w / ratio;
      if (h > area.h - 4) {
        h = area.h - 4;
        w = h * ratio;
      }
      const x = area.x + (area.w - w) / 2;
      const y = area.y + (area.h - h) / 2;
      doc.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST");
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
