import type { Question } from "@/types";
import { measureQuestionImage } from "./pdf-layout";

export interface PackLayoutParams {
  questionCols: number;
  colInnerW: number;
  pageInnerW: number;
  scale: number;
  pageContentH: number;
  spacing: number;
  numBlockH: number;
}

interface PackItem {
  question: Question;
  ratio: number;
  colBlockH: number;
  fullBlockH: number;
  useFull: boolean;
}

function estimateHeights(
  ratio: number,
  params: PackLayoutParams,
  useFull: boolean
): number {
  const maxW = useFull ? params.pageInnerW : params.colInnerW;
  const maxWScaled = maxW * params.scale;
  let h = maxWScaled * ratio;
  const maxH = params.pageContentH * 0.85;
  if (h > maxH) h = maxH;
  return h + params.spacing + params.numBlockH;
}

function shouldUseFullWidth(
  q: Question,
  ratio: number,
  smartPack: boolean
): boolean {
  if (q.layoutSpan === "full") return true;
  if (q.layoutSpan === "column") return false;
  if (!smartPack) return false;
  return ratio >= 1.35;
}

async function buildPackItems(
  questions: Question[],
  params: PackLayoutParams,
  smartPack: boolean
): Promise<PackItem[]> {
  return Promise.all(
    questions.map(async (question) => {
      const { ratio } = await measureQuestionImage(question.imageDataUrl);
      const useFull = shouldUseFullWidth(question, ratio, smartPack);
      return {
        question,
        ratio,
        colBlockH: estimateHeights(ratio, params, false),
        fullBlockH: estimateHeights(ratio, params, true),
        useFull,
      };
    })
  );
}

/** PDF sütun akışına göre soru sırasını optimize eder (tasarruflu kağıt) */
function simulateSequentialPack(
  items: PackItem[],
  params: PackLayoutParams
): Question[] {
  const { questionCols, pageContentH } = params;
  const remaining = new Set(items);
  const result: Question[] = [];

  let simCol = 0;
  let simY = 0;

  const resetColumn = () => {
    if (simCol < questionCols - 1) {
      simCol++;
      simY = 0;
      return true;
    }
    simCol = 0;
    simY = 0;
    return false;
  };

  while (remaining.size > 0) {
    let best: PackItem | null = null;
    let bestScore = Infinity;

    for (const item of remaining) {
      const full = item.useFull && questionCols > 1;
      const blockH = full ? item.fullBlockH : item.colBlockH;

      if (full && simCol !== 0) continue;

      if (simY + blockH > pageContentH) continue;

      const waste = pageContentH - simY - blockH;
      const score = waste + (full ? 0 : item.ratio * 0.1);
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best) {
      if (!resetColumn()) {
        const sorted = [...remaining].sort(
          (a, b) => a.colBlockH - b.colBlockH
        );
        for (const item of sorted) {
          result.push(item.question);
          remaining.delete(item);
        }
        break;
      }
      continue;
    }

    remaining.delete(best);
    result.push(best.question);

    const full = best.useFull && questionCols > 1;
    const blockH = full ? best.fullBlockH : best.colBlockH;
    simY += blockH;

    if (full) {
      simCol = 0;
      simY = 0;
    } else if (simY >= pageContentH * 0.92) {
      resetColumn();
    }
  }

  return result;
}

/** Akıllı yerleşim: panel sırası değil, kağıt tasarrufu için optimal sıra */
export async function packQuestionsForSmartPdf(
  questions: Question[],
  params: PackLayoutParams
): Promise<Question[]> {
  if (questions.length <= 1) return questions;
  const items = await buildPackItems(questions, params, true);
  return simulateSequentialPack(items, params);
}
