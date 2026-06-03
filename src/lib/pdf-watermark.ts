import type { jsPDF } from "jspdf";
import type { PaperSettings } from "@/types";
import { setTurkishFont } from "./pdf-font";

export type PageObstacle = { x: number; y: number; w: number; h: number };

export type WatermarkLayout = {
  pageNumber?: number;
  obstacles?: PageObstacle[];
  margin?: number;
  contentTop?: number;
  contentBottom?: number;
};

const OBSTACLE_PAD = 3;

function imageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function rectsOverlap(a: PageObstacle, b: PageObstacle, pad = OBSTACLE_PAD): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function fits(
  logo: PageObstacle,
  obstacles: PageObstacle[],
  bounds: PageObstacle
): boolean {
  if (
    logo.x < bounds.x ||
    logo.y < bounds.y ||
    logo.x + logo.w > bounds.x + bounds.w ||
    logo.y + logo.h > bounds.y + bounds.h
  ) {
    return false;
  }
  return !obstacles.some((o) => rectsOverlap(logo, o));
}

function buildLogoCandidates(
  pageW: number,
  logoW: number,
  logoH: number,
  margin: number,
  contentTop: number,
  contentBottom: number
): { x: number; y: number }[] {
  const cx = (pageW - logoW) / 2;
  const bottomY = contentBottom - logoH - 5;
  const midY = (contentTop + contentBottom - logoH) / 2;
  const topY = contentTop + 6;

  return [
    { x: cx, y: bottomY },
    { x: pageW - margin - logoW, y: bottomY },
    { x: margin, y: bottomY },
    { x: margin, y: midY },
    { x: pageW - margin - logoW, y: midY },
    { x: pageW - margin - logoW, y: topY },
    { x: margin, y: topY },
    { x: cx, y: midY },
    { x: cx, y: topY },
  ];
}

function findLogoPlacement(
  obstacles: PageObstacle[],
  pageW: number,
  pageH: number,
  logoW: number,
  logoH: number,
  margin: number,
  contentTop: number,
  contentBottom: number
): { x: number; y: number; w: number; h: number } {
  const bounds: PageObstacle = {
    x: margin,
    y: contentTop,
    w: pageW - margin * 2,
    h: Math.max(logoH + 4, contentBottom - contentTop),
  };

  let w = logoW;
  let h = logoH;

  for (let attempt = 0; attempt < 4; attempt++) {
    const candidates = buildLogoCandidates(
      pageW,
      w,
      h,
      margin,
      contentTop,
      contentBottom
    );
    for (const { x, y } of candidates) {
      const rect = { x, y, w, h };
      if (fits(rect, obstacles, bounds)) {
        return { x, y, w, h };
      }
    }
    w *= 0.82;
    h *= 0.82;
  }

  return {
    x: (pageW - w) / 2,
    y: Math.max(contentTop + 4, contentBottom - h - 5),
    w,
    h,
  };
}

function drawTextWatermark(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number,
  alpha: number
) {
  const text = settings.watermarkText || "Dershanem";
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

async function drawLogoWatermark(
  doc: jsPDF,
  dataUrl: string,
  pageW: number,
  pageH: number,
  alpha: number,
  scalePercent: number,
  layout?: WatermarkLayout
) {
  const img = await loadImage(dataUrl);
  const format = imageFormat(dataUrl);
  const margin = layout?.margin ?? 15;
  const contentTop = layout?.contentTop ?? 40;
  const contentBottom = layout?.contentBottom ?? pageH - margin;
  const obstacles = layout?.obstacles ?? [];

  const maxW = (pageW * scalePercent) / 100;
  const maxH = (contentBottom - contentTop) * 0.55;
  const ratio = img.width / img.height;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }

  const placed = findLogoPlacement(
    obstacles,
    pageW,
    pageH,
    w,
    h,
    margin,
    contentTop,
    contentBottom
  );

  const gState = (doc as jsPDF & { GState?: (opts: { opacity: number }) => unknown })
    .GState;
  if (gState) {
    doc.setGState(gState({ opacity: alpha }) as never);
  }

  doc.addImage(
    dataUrl,
    format,
    placed.x,
    placed.y,
    placed.w,
    placed.h,
    undefined,
    "FAST"
  );

  if (gState) {
    doc.setGState(gState({ opacity: 1 }) as never);
  }
}

export async function drawPageWatermark(
  doc: jsPDF,
  settings: PaperSettings,
  pageW: number,
  pageH: number,
  layout?: WatermarkLayout
): Promise<void> {
  if (!settings.watermark) return;

  const prevPage = doc.getCurrentPageInfo().pageNumber;
  if (layout?.pageNumber) {
    doc.setPage(layout.pageNumber);
  }

  const alpha = Math.min(0.55, Math.max(0.03, settings.watermarkOpacity));
  const type =
    settings.watermarkType ??
    (settings.watermarkLogoImage ? "logo" : "text");

  if (type === "logo" && settings.watermarkLogoImage) {
    await drawLogoWatermark(
      doc,
      settings.watermarkLogoImage,
      pageW,
      pageH,
      alpha,
      settings.watermarkLogoScale ?? 45,
      layout
    );
  } else {
    drawTextWatermark(doc, settings, pageW, pageH, alpha);
  }

  if (layout?.pageNumber) {
    doc.setPage(prevPage);
  }
}
