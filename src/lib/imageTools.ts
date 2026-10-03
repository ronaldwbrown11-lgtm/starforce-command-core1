// =========================================================================
// Image tools — client-side auto-resize / optimization + thumbnail
// generation for the global visual upload system. Pure browser code
// (canvas), no Convex imports, so any uploader component can use it.
// =========================================================================

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type OptimizedImage = {
  /** The (possibly re-encoded) image to upload. */
  blob: Blob;
  /** Small JPEG data-URL used for previews / storyboard thumbnails. */
  thumbDataUrl: string;
  width: number;
  height: number;
  /** True when the bytes were re-encoded (resized/optimized). */
  optimized: boolean;
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

function drawScaled(
  source: CanvasImageSource,
  w: number,
  h: number,
  maxDim: number,
) {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Resize to maxDim (default 2048) and re-encode (JPEG for photos, WebP for
 * transparency), then generate a small thumbnail data-URL. Falls back to the
 * original bytes if the browser can't decode the format.
 */
export async function optimizeImage(
  file: File,
  maxDim = 2048,
  thumbDim = 320,
): Promise<OptimizedImage> {
  const fallbackThumb = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      blob: file,
      thumbDataUrl: fallbackThumb,
      width: 0,
      height: 0,
      optimized: false,
    };
  }

  try {
    const { width, height } = bitmap;
    const needsResize = Math.max(width, height) > maxDim;
    const needsCompress = file.size > IMAGE_MAX_BYTES * 0.6;
    let blob: Blob | null = null;
    let optimized = false;
    if (needsResize || needsCompress) {
      const canvas = drawScaled(bitmap, width, height, maxDim);
      if (canvas) {
        const outType =
          file.type === "image/png" || file.type === "image/webp"
            ? "image/webp"
            : "image/jpeg";
        blob = await canvasToBlob(canvas, outType, 0.85);
        optimized = blob !== null;
      }
    }
    if (!blob) blob = file;

    const thumbCanvas = drawScaled(bitmap, width, height, thumbDim);
    const thumbDataUrl = thumbCanvas
      ? thumbCanvas.toDataURL("image/jpeg", 0.75) || fallbackThumb
      : fallbackThumb;

    return {
      blob,
      thumbDataUrl,
      width,
      height,
      optimized,
    };
  } finally {
    bitmap.close();
  }
}
