import type { Question } from "@/types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Soru görseline metin bindirir (PDF çıktısı için) */
export async function renderQuestionToDataUrl(q: Question): Promise<string> {
  const img = await loadImage(q.imageDataUrl);
  const text = q.overlayText?.trim();
  const fontSize = q.fontSize ?? 14;

  if (!text) return q.imageDataUrl;

  const lines = text.split("\n");
  const lineH = fontSize + 6;
  const textH = lines.length * lineH + 16;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height + textH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return q.imageDataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#000000";
  ctx.font = `${fontSize}px Segoe UI, Arial, sans-serif`;
  lines.forEach((line, i) => {
    ctx.fillText(line, 12, img.height + 20 + i * lineH);
  });

  return canvas.toDataURL("image/png");
}

/** Görseli yüzde oranında genişletir (beyaz kenarlık) */
export async function expandQuestionImage(
  dataUrl: string,
  paddingPercent: number
): Promise<string> {
  const img = await loadImage(dataUrl);
  const pad = Math.round(
    Math.max(img.width, img.height) * (paddingPercent / 100)
  );
  const canvas = document.createElement("canvas");
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, pad, pad);
  return canvas.toDataURL("image/png");
}
