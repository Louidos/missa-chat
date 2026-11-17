/** Bild verkleinern (Seitenverhältnis bleibt) und als data-URL liefern. Läuft nur im Browser. */
export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
  type: string;
}

export async function resizeImage(
  file: Blob,
  maxSize: number,
  type: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  quality = 0.9,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar');
    if (type === 'image/jpeg') {
      // JPEG kennt keine Transparenz: weisser Hintergrund statt schwarz.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL(type, quality);
    return { dataUrl, width, height, type: dataUrl.slice(5, dataUrl.indexOf(';')) };
  } finally {
    bitmap.close();
  }
}
