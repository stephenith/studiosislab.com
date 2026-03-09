/**
 * Client-side only. Makes near-white pixels transparent in a PNG/JPG dataURL.
 * Threshold: RGB each >= threshold (default 240) → transparent.
 * Returns new PNG dataURL with transparency.
 */
const DEFAULT_THRESHOLD = 240;

export function removeBackgroundFromDataUrl(
  dataUrl: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const t = Math.min(255, Math.max(0, threshold));
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r >= t && g >= t && b >= t) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}
