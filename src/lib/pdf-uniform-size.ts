import type { Question } from "@/types";
import {
  computeUniformSizingPlan,
  fitImageUniform,
  measureQuestionImage,
  type UniformSizingPlan,
} from "./pdf-layout";

export async function buildUniformSizingPlan(
  questions: Question[],
  renderedById: Map<string, string>,
  colInnerW: number,
  pageInnerW: number,
  scale: number,
  pageContentH: number
): Promise<UniformSizingPlan> {
  const ratios = await Promise.all(
    questions.map(async (q) => {
      const url = renderedById.get(q.id);
      if (!url) return 1;
      const m = await measureQuestionImage(url);
      return m.ratio;
    })
  );
  return computeUniformSizingPlan(
    ratios,
    colInnerW,
    pageInnerW,
    scale,
    pageContentH
  );
}

export function resolveUniformSpanCols(
  q: Question,
  ratio: number,
  questionCols: number,
  colMaxH: number,
  colWidth: number
): number {
  if (questionCols <= 1) return 1;
  const mode = q.layoutSpan ?? "auto";
  if (mode === "full") return questionCols;
  if (mode === "column") return 1;
  const naturalH = colWidth * ratio;
  if (naturalH > colMaxH * 1.35 && ratio >= 1.5) return questionCols;
  return 1;
}

export function fitQuestionForPdf(
  img: HTMLImageElement,
  plan: UniformSizingPlan,
  isFull: boolean,
  remainingH: number
): { w: number; h: number } | null {
  const targetW = isFull ? plan.fullWidth : plan.colWidth;
  const uniformMaxH = isFull ? plan.fullMaxH : plan.colMaxH;
  const ideal = fitImageUniform(img, targetW, uniformMaxH);

  if (ideal.h <= remainingH) return ideal;

  const minAcceptableH = uniformMaxH * 0.82;
  if (remainingH >= minAcceptableH) {
    return fitImageUniform(img, targetW, remainingH);
  }

  return null;
}
