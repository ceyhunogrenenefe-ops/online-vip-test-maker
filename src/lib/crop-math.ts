import type { PixelCrop } from "./crop";

export type ResizeHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const MIN_SIZE = 28;

export function clampCrop(
  crop: PixelCrop,
  imageWidth: number,
  imageHeight: number
): PixelCrop {
  const width = Math.max(MIN_SIZE, Math.min(crop.width, imageWidth));
  const height = Math.max(MIN_SIZE, Math.min(crop.height, imageHeight));
  const x = Math.max(0, Math.min(crop.x, imageWidth - width));
  const y = Math.max(0, Math.min(crop.y, imageHeight - height));
  return { x, y, width, height };
}

export function applyResize(
  start: PixelCrop,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number
): PixelCrop {
  let { x, y, width, height } = start;

  if (handle === "move") {
    x += deltaX;
    y += deltaY;
    return clampCrop({ x, y, width, height }, imageWidth, imageHeight);
  }

  if (handle.includes("e")) width += deltaX;
  if (handle.includes("w")) {
    width -= deltaX;
    x += deltaX;
  }
  if (handle.includes("s")) height += deltaY;
  if (handle.includes("n")) {
    height -= deltaY;
    y += deltaY;
  }

  return clampCrop({ x, y, width, height }, imageWidth, imageHeight);
}

export function defaultCenterCrop(
  imageWidth: number,
  imageHeight: number
): PixelCrop {
  const width = Math.round(imageWidth * 0.55);
  const height = Math.round(imageHeight * 0.2);
  return clampCrop(
    {
      x: Math.round((imageWidth - width) / 2),
      y: Math.round(imageHeight * 0.15),
      width,
      height,
    },
    imageWidth,
    imageHeight
  );
}
