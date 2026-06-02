export interface EnhanceSettings {
  /** 0.5 – 2, varsayılan 1 */
  contrast: number;
  /** -40 – 40 */
  brightness: number;
  /** 0 – 2 keskinleştirme */
  sharpness: number;
}

export const DEFAULT_ENHANCE: EnhanceSettings = {
  contrast: 1.1,
  brightness: 5,
  sharpness: 0.6,
};

export function applyEnhanceToImageData(
  imageData: ImageData,
  settings: EnhanceSettings
): void {
  const { data, width, height } = imageData;
  const { contrast, brightness } = settings;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = (data[i + c] - 128) * contrast + 128 + brightness;
      data[i + c] = Math.max(0, Math.min(255, v));
    }
  }

  if (settings.sharpness > 0.05) {
    unsharpMask(imageData, width, height, settings.sharpness);
  }
}

/** Basit 3x3 box blur + unsharp mask */
function unsharpMask(
  imageData: ImageData,
  width: number,
  height: number,
  amount: number
) {
  const src = new Uint8ClampedArray(imageData.data);
  const { data } = imageData;
  const strength = amount * 0.8;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += src[idx];
          }
        }
        const blur = sum / 9;
        const idx = (y * width + x) * 4 + c;
        const orig = src[idx];
        const sharp = orig + strength * (orig - blur);
        data[idx] = Math.max(0, Math.min(255, sharp));
      }
    }
  }
}

export async function enhanceDataUrl(
  dataUrl: string,
  settings: EnhanceSettings
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyEnhanceToImageData(imageData, settings);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
