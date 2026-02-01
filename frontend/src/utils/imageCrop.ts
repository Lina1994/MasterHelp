/**
 * Utilities to crop images client-side.
 *
 * We use this for character token images so the user can select the best framing
 * (e.g., focus on the face) while keeping backend unchanged.
 */

export type CropAreaPixels = {
  width: number;
  height: number;
  x: number;
  y: number;
};

const createHtmlImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed for remote URLs to avoid tainting the canvas (if the server sends CORS headers).
    // For data URLs it has no effect.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Crops an input image to a square output and returns a PNG data URL.
 *
 * @param imageSrc Source URL (data URL or remote URL).
 * @param crop Cropped rectangle in source pixel coordinates.
 * @param outputSizePx Output image size in pixels (square).
 * @returns PNG data URL with the cropped image.
 */
export async function cropToPngDataUrl(
  imageSrc: string,
  crop: CropAreaPixels,
  outputSizePx: number = 512,
): Promise<string> {
  const image = await createHtmlImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = outputSizePx;
  canvas.height = outputSizePx;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Ensure crop is clamped to the source image bounds.
  const sx = Math.max(0, Math.min(image.width, crop.x));
  const sy = Math.max(0, Math.min(image.height, crop.y));
  const sw = Math.max(1, Math.min(image.width - sx, crop.width));
  const sh = Math.max(1, Math.min(image.height - sy, crop.height));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw source crop into square output.
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputSizePx, outputSizePx);

  return canvas.toDataURL('image/png');
}
