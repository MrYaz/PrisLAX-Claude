import * as pdfjsLib from 'pdfjs-dist';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractBatch, buildPrompt, type BatchTask } from './ai';

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
    message: `PDF laddad: ${totalPages} sidor — renderar alla sidor...`,
    current: 0,
    total: totalPages,
    stats: { ...stats },
  });

  // ── Phase 1: Pre-render ALL pages to base64 (fast, main thread) ──
  const renderedPages: { pageNum: number; base64: string }[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (signal.aborted) break;
    const base64 = await renderPageToBase64(pdf, p);
    renderedPages.push({ pageNum: p, base64 });
    onProgress({
      message: `Renderat sida ${p} av ${totalPages}...`,
      current: 0,
      total: totalPages,
      stats: { ...stats },
    });
  }

  if (signal.aborted || renderedPages.length === 0) {
    return [];
  }

  // ── Phase 2: Send entire batch to worker ──
  // Build all tasks upfront — the worker handles concurrency internally
  const batchTasks: BatchTask[] = renderedPages.map(({ pageNum, base64 }) => ({
    taskId: pageNum,
    kind: 'image' as const,
    imageBase64: base64,
    mimeType: 'image/png',
    prompt: buildPrompt(
      supplierHint,
      `This is page ${pageNum} of ${totalPages} from a PDF price list named "${file.name}".`
    ),
    label: `Sida ${pageNum}`,
  }));

  let completedCount = 0;
  const active = Math.min(CONCURRENCY, totalPages);

  onProgress({
    message: `Analyserar ${totalPages} sidor (${active} parallellt i bakgrunden)...`,
    current: 0,
    total: totalPages,
    stats: { ...stats },
  });

  const resultsByPage = new Map<number, RawExtractedRow[]>();

  const { succeeded } = await extractBatch(batchTasks, CONCURRENCY, {
    onTaskDone: (taskId, rows, label) => {
      resultsByPage.set(taskId, rows);
      completedCount++;
      updateStats(stats, rows, label);
      onProgress({
        message: `${label} klar (${completedCount} av ${totalPages})`,
        current: completedCount,
        total: totalPages,
        stats: { ...stats },
      });
    },
    onTaskError: (taskId, error, label) => {
      completedCount++;
      console.warn(`Sida ${taskId} misslyckades: ${error.message}`);
      onProgress({
        message: `${label} misslyckades (${completedCount} av ${totalPages})`,
        current: completedCount,
        total: totalPages,
        stats: { ...stats },
      });
    },
  });

  if (succeeded === 0) {
    throw new Error('AI-anrop misslyckades för alla sidor');
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
