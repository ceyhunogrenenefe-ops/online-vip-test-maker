/** Beyaz fırça veya dikdörtgen ile görselden alan silme */

export async function applyWhiteBrush(
  imageDataUrl: string,
  strokes: { x: number; y: number; size: number }[]
): Promise<string> {
  const canvas = await imageToCanvas(imageDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx || strokes.length === 0) return imageDataUrl;

  ctx.fillStyle = "#ffffff";
  strokes.forEach((s) => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
  return canvas.toDataURL("image/png");
}

export async function eraseRectangle(
  imageDataUrl: string,
  rect: { x: number; y: number; width: number; height: number }
): Promise<string> {
  const canvas = await imageToCanvas(imageDataUrl);
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageDataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  return canvas.toDataURL("image/png");
}

async function imageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas yok");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
