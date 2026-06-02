import {
  applyEnhanceToImageData,
  type EnhanceSettings,
  DEFAULT_ENHANCE,
} from "./image-enhance";

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: PixelCrop,
  enhance: EnhanceSettings = DEFAULT_ENHANCE
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas desteklenmiyor");

  const w = Math.max(1, Math.round(pixelCrop.width));
  const h = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    w,
    h
  );

  const imageData = ctx.getImageData(0, 0, w, h);
  applyEnhanceToImageData(imageData, enhance);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Kırpma alanını react-easy-crop için merkez konumuna çevirir */
export function cropAreaToPosition(
  crop: PixelCrop,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    x: (cx / imageWidth) * 100 - 50,
    y: (cy / imageHeight) * 100 - 50,
  };
}

export function estimateZoomForCrop(
  crop: PixelCrop,
  imageWidth: number,
  imageHeight: number
): number {
  const cover = Math.min(
    imageWidth / crop.width,
    imageHeight / crop.height
  );
  return Math.min(3, Math.max(1, cover * 0.85));
}
