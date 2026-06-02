import type { Question, QuestionLayoutSpan } from "@/types";

export function resolveLayoutSpan(
  q: Question,
  img: HTMLImageElement,
  paperCols: number,
  colInnerW: number,
  pageInnerW: number,
  remainingH: number
): number {
  const mode: QuestionLayoutSpan = q.layoutSpan ?? "auto";
  if (paperCols <= 1) return 1;
  if (mode === "full") return paperCols;
  if (mode === "column") return 1;

  const ratio = img.height / img.width;
  const hIfCol = colInnerW * ratio;
  const tall = ratio >= 1.05;
  const tooTallForColumn = hIfCol > remainingH * 0.92;
  const narrowStrip = ratio >= 0.85 && hIfCol > pageInnerW * 0.55;

  return tall || tooTallForColumn || narrowStrip ? paperCols : 1;
}

/** Sütun/genişlik kutusuna sığdırır; mümkün olduğunca geniş ve okunaklı tutar */
export function fitImageInBox(
  img: HTMLImageElement,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (maxW <= 0 || maxH <= 0) return { w: 1, h: 1 };

  const ratio = img.height / img.width;
  let w = maxW;
  let h = w * ratio;

  if (h > maxH) {
    h = maxH;
    w = h / ratio;
  }

  const minFill = maxW * 0.92;
  if (w < minFill && h < maxH * 0.98) {
    w = Math.min(maxW, minFill);
    h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
  }

  return { w, h };
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

/** Uzun sorular önce — PDF’te daha iyi yerleşim */
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
