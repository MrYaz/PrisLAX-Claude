import * as pdfjsLib from 'pdfjs-dist';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractFromImage } from './ai';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PAGES_PER_CHUNK = 2;
const RENDER_SCALE = 2;

function updateStats(stats: ExtractionStats, rows: RawExtractedRow[], label: string): void {
  const articles = rows.filter((r) => !r.isAccessory).length;
  const accessories = rows.filter((r) => r.isAccessory).length;
  stats.articlesFound += rows.length;
  stats.accessoriesFound += accessories;
  if (rows.length > 0) {
    stats.pageDetails.push({ label, articles, accessories });
  }
  for (const r of rows) {
    if (r.varugrupp && !stats.varugrupper.includes(r.varugrupp)) {
      stats.varugrupper.push(r.varugrupp);
    }
  }
}

export async function processPdf(
  file: File,
  supplierHint: string,
  onProgress: (info: ProgressInfo) => void,
  signal: AbortSignal
): Promise<RawExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const stats: ExtractionStats = {
    articlesFound: 0,
    accessoriesFound: 0,
    varugrupper: [],
    pageDetails: [],
  };

  onProgress({
    message: `PDF laddad: ${totalPages} sidor`,
    current: 0,
    total: totalPages,
    stats: { ...stats },
  });

  const allRows: RawExtractedRow[] = [];
  let hasSucceeded = false;
  let errorCount = 0;

  for (let startPage = 1; startPage <= totalPages; startPage += PAGES_PER_CHUNK) {
    if (signal.aborted) {
      onProgress({
        message: `Stoppad efter sida ${startPage - 1} av ${totalPages}`,
        current: startPage - 1,
        total: totalPages,
        stats: { ...stats },
      });
      break;
    }

    const endPage = Math.min(startPage + PAGES_PER_CHUNK - 1, totalPages);

    onProgress({
      message: `Behandlar sida ${startPage}–${endPage} (av ${totalPages})`,
      current: startPage - 1,
      total: totalPages,
      stats: { ...stats },
    });

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      if (signal.aborted) break;

      const imageBase64 = await renderPageToBase64(pdf, pageNum);
      const contextHint = `This is page ${pageNum} of ${totalPages} from a PDF price list named "${file.name}".`;

      try {
        const rows = await extractFromImage(imageBase64, 'image/png', supplierHint, contextHint);
        allRows.push(...rows);
        hasSucceeded = true;
        updateStats(stats, rows, `Sida ${pageNum}`);
      } catch (err) {
        errorCount++;
        const lastError = err instanceof Error ? err : new Error(String(err));
        if (!hasSucceeded) {
          throw new Error(`AI-anrop misslyckades (sida ${pageNum}): ${lastError.message}`);
        }
        console.warn(`Sida ${pageNum} misslyckades, fortsätter: ${lastError.message}`);
      }
    }

    if (!signal.aborted) {
      onProgress({
        message: `Sida ${startPage}–${Math.min(startPage + PAGES_PER_CHUNK - 1, totalPages)} klar (av ${totalPages})`,
        current: Math.min(startPage + PAGES_PER_CHUNK - 1, totalPages),
        total: totalPages,
        stats: { ...stats },
      });
    }
  }

  if (errorCount > 0) {
    console.warn(`PDF-behandling klar med ${errorCount} misslyckade sidor av ${totalPages}`);
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

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  canvas.width = 0;
  canvas.height = 0;

  return base64;
}
