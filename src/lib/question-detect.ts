import type { PixelCrop } from "./crop";

export interface DetectedQuestion {
  id: string;
  crop: PixelCrop;
  /** 0–1 güven skoru */
  confidence: number;
}

interface DetectOptions {
  minGapPx?: number;
  minBlockHeightPx?: number;
  paddingPx?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rowInkRatio(
  data: Uint8ClampedArray,
  w: number,
  y: number,
  x0: number,
  x1: number
): number {
  let dark = 0;
  const span = x1 - x0;
  for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 4;
    const gray =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (gray < 210) dark++;
  }
  return dark / span;
}

function columnHasContent(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  x1: number
): boolean {
  let inkRows = 0;
  for (let y = 0; y < h; y += 4) {
    if (rowInkRatio(data, w, y, x0, x1) > 0.025) inkRows++;
  }
  return inkRows > h / 80;
}

function detectInStrip(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  x1: number,
  scale: number,
  opts: Required<DetectOptions>
): DetectedQuestion[] {
  const minGap = Math.max(4, Math.round(opts.minGapPx / scale));
  const minHeight = Math.max(20, Math.round(opts.minBlockHeightPx / scale));
  const pad = Math.round(opts.paddingPx / scale);

  const rows: boolean[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(rowInkRatio(data, w, y, x0, x1) > 0.022);
  }

  const blocks: { y0: number; y1: number }[] = [];
  let start: number | null = null;
  let gap = 0;

  for (let y = 0; y < h; y++) {
    if (rows[y]) {
      if (start === null) start = y;
      gap = 0;
    } else if (start !== null) {
      gap++;
      if (gap >= minGap) {
        const y1 = y - gap;
        if (y1 - start >= minHeight) blocks.push({ y0: start, y1 });
        start = null;
        gap = 0;
      }
    }
  }
  if (start !== null && h - start >= minHeight) {
    blocks.push({ y0: start, y1: h - 1 });
  }

  return blocks.map((b, i) => {
    const y = Math.max(0, b.y0 - pad);
    const bh = Math.min(h - y, b.y1 - b.y0 + 1 + pad * 2);
    const x = Math.max(0, x0 - pad);
    const bw = Math.min(w - x, x1 - x0 + pad * 2);

    const heightRatio = bh / h;
    const conf = Math.min(
      0.95,
      0.55 + heightRatio * 0.35 + (blocks.length <= 25 ? 0.1 : 0)
    );

    return {
      id: `q-${i + 1}`,
      crop: {
        x: Math.round(x * scale),
        y: Math.round(y * scale),
        width: Math.round(bw * scale),
        height: Math.round(bh * scale),
      },
      confidence: conf,
    };
  });
}

/**
 * Sınav PDF/görsellerinde soru bölgelerini dikey boşluk analizi ile bulur.
 */
export async function detectQuestionsOnImage(
  imageSrc: string,
  options: DetectOptions = {}
): Promise<DetectedQuestion[]> {
  const opts: Required<DetectOptions> = {
    minGapPx: options.minGapPx ?? 14,
    minBlockHeightPx: options.minBlockHeightPx ?? 55,
    paddingPx: options.paddingPx ?? 10,
  };

  const img = await loadImage(imageSrc);
  const maxAnalyzeWidth = 1400;
  const scale =
    img.width > maxAnalyzeWidth ? maxAnalyzeWidth / img.width : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const mid = Math.floor(w * 0.5);
  const gutter = Math.floor(w * 0.04);
  const twoColumns =
    columnHasContent(data, w, h, 0, mid - gutter) &&
    columnHasContent(data, w, h, mid + gutter, w);

  const regions: DetectedQuestion[] = [];

  if (twoColumns) {
    regions.push(
      ...detectInStrip(data, w, h, 0, mid - gutter, scale, opts),
      ...detectInStrip(data, w, h, mid + gutter, w, scale, opts)
    );
  } else {
    regions.push(...detectInStrip(data, w, h, 0, w, scale, opts));
  }

  regions.sort((a, b) => a.crop.y - b.crop.y || a.crop.x - b.crop.x);

  return regions.map((r, i) => ({ ...r, id: `q-${i + 1}` }));
}
