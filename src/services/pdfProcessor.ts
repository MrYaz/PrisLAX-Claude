import * as pdfjsLib from 'pdfjs-dist';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractFromImage } from './ai';
import { runParallel, type ParallelTask } from './parallelRunner';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const RENDER_SCALE = 2;
const CONCURRENCY = 2;

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

  // Build one task per page — each task renders + sends to Gemini
  const tasks: ParallelTask<{ pageNum: number; rows: RawExtractedRow[] }>[] = [];
  for (let p = 1; p <= totalPages; p++) {
    const pageNum = p;
    tasks.push({
      label: `Sida ${pageNum}`,
      run: async () => {
        const base64 = await renderPageToBase64(pdf, pageNum);
        const contextHint = `This is page ${pageNum} of ${totalPages} from a PDF price list named "${file.name}".`;
        const rows = await extractFromImage(base64, 'image/png', supplierHint, contextHint);
        return { pageNum, rows };
      },
    });
  }

  let completedCount = 0;
  const active = Math.min(CONCURRENCY, totalPages);

  onProgress({
    message: `Analyserar ${totalPages} sidor (${active} parallellt)...`,
    current: 0,
    total: totalPages,
    stats: { ...stats },
  });

  // Results indexed by page number to preserve order
  const resultsByPage = new Map<number, RawExtractedRow[]>();

  const { succeeded, firstError } = await runParallel(tasks, {
    concurrency: CONCURRENCY,
    signal,
    onTaskDone: (result, _index, label) => {
      resultsByPage.set(result.pageNum, result.rows);
      completedCount++;
      updateStats(stats, result.rows, label);
      onProgress({
        message: `${label} klar (${completedCount} av ${totalPages})`,
        current: completedCount,
        total: totalPages,
        stats: { ...stats },
      });
    },
    onTaskError: (error, _index, label) => {
      completedCount++;
      console.warn(`${label} misslyckades: ${error.message}`);
      onProgress({
        message: `${label} misslyckades (${completedCount} av ${totalPages})`,
        current: completedCount,
        total: totalPages,
        stats: { ...stats },
      });
    },
  });

  if (succeeded === 0 && firstError) {
    throw new Error(`AI-anrop misslyckades: ${firstError.message}`);
  }

  // Combine results in page order
  const allRows: RawExtractedRow[] = [];
  for (let p = 1; p <= totalPages; p++) {
    const rows = resultsByPage.get(p);
    if (rows) allRows.push(...rows);
  }

  if (signal.aborted) {
    onProgress({
      message: `Stoppad — ${completedCount} av ${totalPages} sidor behandlade`,
      current: completedCount,
      total: totalPages,
      stats: { ...stats },
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

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  canvas.width = 0;
  canvas.height = 0;

  return base64;
}
