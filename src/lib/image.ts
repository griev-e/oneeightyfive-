/** Pure fit-within-max-edge math — scales down only, floors at 1×1. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Downsize camera images before upload; enough detail for labels without
 * sending a full-resolution phone photo through the serverless function. */
export async function prepareFoodImage(file: File): Promise<File> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup: () => void;
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(url);
  }

  const fitted = fitWithin(width, height, 1800);
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const context = canvas.getContext("2d");
  if (!context) {
    cleanup();
    throw new Error("Canvas is unavailable");
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  cleanup();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Image conversion failed")),
      "image/jpeg",
      0.86,
    ),
  );
  return new File([blob], "food.jpg", { type: "image/jpeg" });
}
