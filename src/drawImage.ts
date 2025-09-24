import { assert } from "./utils.js";

export async function drawImage(
  imageBitmap: ImageBitmap,
  canvas: HTMLCanvasElement | OffscreenCanvas,
) {
  const ctx = canvas.getContext("2d");
  assert(ctx !== null, "failed to get canvas canvas");

  // Calculate the scale to fill the entire canvas (center crop)
  const scale = Math.max(
    canvas.width / imageBitmap.width,
    canvas.height / imageBitmap.height,
  );

  // Calculate the crop area in the original image coordinates
  const cropWidth = canvas.width / scale;
  const cropHeight = canvas.height / scale;

  // Center the crop area
  const cropX = (imageBitmap.width - cropWidth) / 2;
  const cropY = (imageBitmap.height - cropHeight) / 2;

  // Clear canvas and set smoothing for better quality
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped and scaled image
  ctx.drawImage(
    imageBitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight, // Source crop area
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // Clean up
  imageBitmap.close();
}
