"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsModule: typeof import("pdfjs-dist") | null = null;

async function getPdfJs() {
  if (pdfjsModule) return pdfjsModule;
  pdfjsModule = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsModule.version}/build/pdf.worker.min.mjs`;
  }
  return pdfjsModule;
}

const docCache = new Map<string, PDFDocumentProxy>();

function cacheKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export async function openPdfDocument(file: File): Promise<PDFDocumentProxy> {
  const key = cacheKey(file);
  const cached = docCache.get(key);
  if (cached) return cached;

  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  docCache.set(key, doc);
  return doc;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const doc = await openPdfDocument(file);
  return doc.numPages;
}

/** PDF sayfasını yüksek çözünürlüklü görsele çevirir */
export async function renderPdfPageToDataUrl(
  file: File,
  pageNumber: number,
  scale = 2
): Promise<string> {
  const pdfjs = await getPdfJs();
  const doc = await openPdfDocument(file);
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas oluşturulamadı");

  const task = page.render({ canvasContext: ctx, viewport });
  await task.promise;
  return canvas.toDataURL("image/png");
}

export function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}
