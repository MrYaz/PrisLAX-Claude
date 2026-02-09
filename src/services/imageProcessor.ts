import type { RawExtractedRow, ProgressInfo } from '../types';
import { extractFromImage } from './ai';

export async function processImage(
  file: File,
  supplierHint: string,
  onProgress: (info: ProgressInfo) => void,
  _signal: AbortSignal
): Promise<RawExtractedRow[]> {
  onProgress({
    message: 'Analyserar bild...',
    current: 0,
    total: 1,
  });

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/png';
  const contextHint = `This is an image file named "${file.name}". It likely contains a price list or product table. Extract all product data visible.`;

  const rows = await extractFromImage(base64, mimeType, supplierHint, contextHint);
  onProgress({ message: 'Bild analyserad', current: 1, total: 1 });
  return rows;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
