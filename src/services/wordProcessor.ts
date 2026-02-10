import mammoth from 'mammoth';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractFromText } from './ai';
import { runParallel, type ParallelTask } from './parallelRunner';

const MAX_CHARS_PER_CHUNK = 8000;
const CONCURRENCY = 4;

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

export async function processWord(
  file: File,
  supplierHint: string,
  onProgress: (info: ProgressInfo) => void,
  signal: AbortSignal
): Promise<RawExtractedRow[]> {
  const stats: ExtractionStats = {
    articlesFound: 0,
    accessoriesFound: 0,
    varugrupper: [],
    pageDetails: [],
  };

  onProgress({
    message: 'Läser Word-dokument...',
    current: 0,
    total: 1,
    stats: { ...stats },
  });

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  if (!text.trim()) {
    onProgress({ message: 'Word-dokumentet var tomt', current: 1, total: 1, stats: { ...stats } });
    return [];
  }

  // Split into chunks
  const paragraphs = text.split('\n');
  const textChunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > MAX_CHARS_PER_CHUNK && currentChunk) {
      textChunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += para + '\n';
  }
  if (currentChunk.trim()) textChunks.push(currentChunk);

  const totalChunks = textChunks.length;

  // Create parallel tasks
  const tasks: ParallelTask<{ chunkIndex: number; rows: RawExtractedRow[] }>[] = textChunks.map(
    (chunkText, i) => ({
      label: `Del ${i + 1}`,
      run: async () => {
        const contextHint = `This text comes from a Word document named "${file.name}", part ${i + 1} of ${totalChunks}.`;
        const rows = await extractFromText(chunkText, supplierHint, contextHint);
        return { chunkIndex: i, rows };
      },
    })
  );

  let completedCount = 0;
  const active = Math.min(CONCURRENCY, totalChunks);

  onProgress({
    message: `Analyserar Word-dokument (${totalChunks} delar, ${active} parallellt)...`,
    current: 0,
    total: totalChunks,
    stats: { ...stats },
  });

  const resultsByChunk = new Map<number, RawExtractedRow[]>();

  const { succeeded, firstError } = await runParallel(tasks, {
    concurrency: CONCURRENCY,
    signal,
    onTaskDone: (res, _index, label) => {
      resultsByChunk.set(res.chunkIndex, res.rows);
      completedCount++;
      updateStats(stats, res.rows, label);
      onProgress({
        message: `${label} klar (${completedCount} av ${totalChunks})`,
        current: completedCount,
        total: totalChunks,
        stats: { ...stats },
      });
    },
    onTaskError: (error, _index, label) => {
      completedCount++;
      console.warn(`${label} misslyckades: ${error.message}`);
      onProgress({
        message: `${label} misslyckades (${completedCount} av ${totalChunks})`,
        current: completedCount,
        total: totalChunks,
        stats: { ...stats },
      });
    },
  });

  if (succeeded === 0 && firstError) {
    throw new Error(`AI-anrop misslyckades: ${firstError.message}`);
  }

  // Combine results in order
  const allRows: RawExtractedRow[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const rows = resultsByChunk.get(i);
    if (rows) allRows.push(...rows);
  }

  return allRows;
}
