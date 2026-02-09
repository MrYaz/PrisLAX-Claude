import * as pdfjsLib from 'pdfjs-dist';
import type { RawExtractedRow, ProgressInfo } from '../types';
import { extractFromImage } from './ai';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PAGES_PER_CHUNK = 2;
const RENDER_SCALE = 2; // 2x for readability

/**
 * Process a PDF file: split into pages, render each as image, extract via AI.
 */
export async function processPdf(
  file: File,
  onProgress: (info: ProgressInfo) => void
): Promise<RawExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  onProgress({
    message: `PDF laddad: ${totalPages} sidor`,
    current: 0,
    total: totalPages,
  });

  const allRows: RawExtractedRow[] = [];

  // Process in chunks of PAGES_PER_CHUNK
  for (let startPage = 1; startPage <= totalPages; startPage += PAGES_PER_CHUNK) {
    const endPage = Math.min(startPage + PAGES_PER_CHUNK - 1, totalPages);

    onProgress({
      message: `Behandlar sida ${startPage}–${endPage} (av ${totalPages})`,
      current: startPage - 1,
      total: totalPages,
    });

    // Render each page in this chunk and send to AI
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const imageBase64 = await renderPageToBase64(pdf, pageNum);
      const contextHint = `This is page ${pageNum} of ${totalPages} from a PDF price list named "${file.name}".`;

      try {
        const rows = await extractFromImage(imageBase64, 'image/png', contextHint);
        allRows.push(...rows);
      } catch (err) {
        console.error(`Error extracting from page ${pageNum}:`, err);
        // Continue with remaining pages
      }
    }

    onProgress({
      message: `Sida ${startPage}–${endPage} klar (av ${totalPages})`,
      current: endPage,
      total: totalPages,
    });
  }

  return allRows;
}

async function renderPageToBase64(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  // Convert to base64 PNG (strip data URL prefix)
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  // Clean up
  canvas.width = 0;
  canvas.height = 0;

  return base64;
}
