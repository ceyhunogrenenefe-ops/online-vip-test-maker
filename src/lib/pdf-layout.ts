import type { Question, QuestionLayoutSpan } from "@/types";

export function spanWidthMm(
  colW: number,
  colGap: number,
  spanCols: number
): number {
  return spanCols * colW + (spanCols - 1) * colGap;
}

export function columnContentWidth(
  colW: number,
  colGap: number,
  spanCols: number,
  numWidth: number,
  pad = 4
): number {
  return spanWidthMm(colW, colGap, spanCols) - numWidth - pad;
}

export function resolveLayoutSpan(
  q: Question,
  img: HTMLImageElement,
  paperCols: number,
  colInnerW: number,
  pageInnerW: number,
  remainingH: number,
  strictColumnFit: boolean,
  smartPack = false
): number {
  const mode: QuestionLayoutSpan = q.layoutSpan ?? "auto";
  if (paperCols <= 1) return 1;
  if (mode === "full") return paperCols;
  if (mode === "column") return 1;

  const ratio = img.height / img.width;

  if (smartPack) {
    if (ratio >= 1.35) return paperCols;
    if (ratio >= 1.15 && colInnerW * ratio > remainingH * 0.9) {
      return paperCols;
    }
    return 1;
  }

  if (!strictColumnFit && paperCols >= 2) {
    const wideLandscape = ratio < 0.72;
    return wideLandscape ? 1 : paperCols;
  }

  const hIfCol = colInnerW * ratio;
  const tall = ratio >= 1.15;
  const tooTallForColumn = hIfCol > remainingH * 0.88;

  return tall || tooTallForColumn ? paperCols : 1;
}

export function layoutHintsForColumns(
  columns: number,
  strictColumnFit: boolean,
  smartPack = false
) {
  const multi = columns >= 2;
  return {
    minFillRatio: smartPack ? 0.82 : strictColumnFit ? 0 : multi ? 0.88 : 0.92,
    minHeightMm: smartPack ? 22 : multi ? 28 : 35,
    strict: smartPack ? true : strictColumnFit,
  };
}

/** Kutu içine sığdır; strict modda asla taşmaz */
export function fitImageInBox(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
  minFillRatio = 0.92,
  strict = false
): { w: number; h: number } {
  if (maxW <= 0 || maxH <= 0) return { w: 1, h: 1 };

  const ratio = img.height / img.width;
  let w = maxW;
  let h = w * ratio;

  if (h > maxH) {
    h = maxH;
    w = h / ratio;
  }

  if (!strict) {
    const minFill = maxW * minFillRatio;
    if (w < minFill && h < maxH * 0.98) {
      w = Math.min(maxW, minFill);
      h = w * ratio;
      if (h > maxH) {
        h = maxH;
        w = h / ratio;
      }
    }
  }

  w = Math.min(w, maxW);
  h = Math.min(h, maxH);

  return { w, h };
}

/** Sütun genişliğine hizala; yükseklik taşarsa orantılı küçült */
export function fitImageUniform(
  img: HTMLImageElement,
  targetW: number,
  maxH: number
): { w: number; h: number } {
  if (targetW <= 0 || maxH <= 0) return { w: 1, h: 1 };
  const ratio = img.height / img.width;
  let w = targetW;
  let h = w * ratio;
  if (h > maxH) {
    h = maxH;
    w = h / ratio;
  }
  return { w, h };
}

export interface UniformSizingPlan {
  colWidth: number;
  colMaxH: number;
  fullWidth: number;
  fullMaxH: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 40;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * p))
  );
  return sorted[idx];
}

/** Tüm sorular için ortak genişlik ve yükseklik bandı hesaplar */
export function computeUniformSizingPlan(
  ratios: number[],
  colInnerW: number,
  pageInnerW: number,
  scale: number,
  pageContentH: number
): UniformSizingPlan {
  const colWidth = colInnerW * scale;
  const fullWidth = pageInnerW * scale;
  const naturalHeights = ratios.map((r) => colWidth * r).sort((a, b) => a - b);
  const median = percentile(naturalHeights, 0.5);
  const p70 = percentile(naturalHeights, 0.7);

  const colMaxH = Math.min(
    pageContentH * 0.44,
    Math.max(32, Math.min(p70 * 1.05, median * 1.15))
  );

  const widthRatio = fullWidth / Math.max(colWidth, 1);
  const fullMaxH = Math.min(pageContentH * 0.52, colMaxH * widthRatio * 0.92);

  return { colWidth, colMaxH, fullWidth, fullMaxH };
}

export async function measureQuestionImage(
  dataUrl: string
): Promise<{ width: number; height: number; ratio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.width,
        height: img.height,
        ratio: img.height / img.width,
      });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function sortDraftIdsByVisualSize(
  ids: string[],
  questions: Question[]
): Promise<string[]> {
  const metrics = await Promise.all(
    ids.map(async (id) => {
      const q = questions.find((x) => x.id === id);
      if (!q) return { id, ratio: 1 };
      const m = await measureQuestionImage(q.imageDataUrl);
      return { id, ratio: m.ratio };
    })
  );
  return [...metrics]
    .sort((a, b) => b.ratio - a.ratio)
    .map((m) => m.id);
}
