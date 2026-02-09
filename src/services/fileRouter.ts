import type { RawExtractedRow, ProgressInfo, SupportedFileType } from '../types';
import { validateApiKey } from './ai';
import { processPdf } from './pdfProcessor';
import { processExcel } from './excelProcessor';
import { processWord } from './wordProcessor';
import { processImage } from './imageProcessor';

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
const WORD_EXTENSIONS = ['.docx', '.doc'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'];

export function detectFileType(file: File): SupportedFileType | null {
  const name = file.name.toLowerCase();
  const ext = '.' + name.split('.').pop();

  if (ext === '.pdf') return 'pdf';
  if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
  if (WORD_EXTENSIONS.includes(ext)) return 'word';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';

  // Fallback: check MIME type
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'excel';
  if (file.type.includes('word') || file.type.includes('document')) return 'word';
  if (file.type.startsWith('image/')) return 'image';

  return null;
}

/**
 * Route a file to the appropriate processor based on type.
 */
export async function processFile(
  file: File,
  onProgress: (info: ProgressInfo) => void
): Promise<RawExtractedRow[]> {
  const fileType = detectFileType(file);

  if (!fileType) {
    throw new Error(
      `Filtypen "${file.name}" stöds inte. Använd PDF, Excel, Word eller bild.`
    );
  }

  // Validate API key before starting any processing
  validateApiKey();

  switch (fileType) {
    case 'pdf':
      return processPdf(file, onProgress);
    case 'excel':
      return processExcel(file, onProgress);
    case 'word':
      return processWord(file, onProgress);
    case 'image':
      return processImage(file, onProgress);
  }
}
