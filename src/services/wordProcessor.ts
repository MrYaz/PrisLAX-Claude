import mammoth from 'mammoth';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractBatch, buildPrompt, type BatchTask } from './ai';

const MAX_CHARS_PER_CHUNK = 8000;
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

  // ── Phase 1: Split into chunks (fast, no API calls) ──
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

  if (signal.aborted) return [];

  // ── Phase 2: Send entire batch to worker ──
  const batchTasks: BatchTask[] = textChunks.map((chunkText, i) => ({
    taskId: i,
    kind: 'text' as const,
    textContent: chunkText,
    prompt: buildPrompt(
      supplierHint,
      `This text comes from a Word document named "${file.name}", part ${i + 1} of ${totalChunks}.`
    ),
    label: `Del ${i + 1}`,
  }));

  let completedCount = 0;
  const active = Math.min(CONCURRENCY, totalChunks);

  onProgress({
    message: `Analyserar Word-dokument (${totalChunks} delar, ${active} parallellt i bakgrunden)...`,
    current: 0,
    total: totalChunks,
    stats: { ...stats },
  });

  const resultsByChunk = new Map<number, RawExtractedRow[]>();

  const { succeeded } = await extractBatch(batchTasks, CONCURRENCY, {
    onTaskDone: (taskId, rows, label) => {
      resultsByChunk.set(taskId, rows);
      completedCount++;
      updateStats(stats, rows, label);
      onProgress({
        message: `${label} klar (${completedCount} av ${totalChunks})`,
        current: completedCount,
        total: totalChunks,
        stats: { ...stats },
      });
    },
    onTaskError: (taskId, error, label) => {
      completedCount++;
      console.warn(`Del ${taskId + 1} misslyckades: ${error.message}`);
      onProgress({
        message: `${label} misslyckades (${completedCount} av ${totalChunks})`,
        current: completedCount,
        total: totalChunks,
        stats: { ...stats },
      });
    },
  });

  if (succeeded === 0) {
    throw new Error('AI-anrop misslyckades för alla delar');
  }

  // Combine results in order
  const allRows: RawExtractedRow[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const rows = resultsByChunk.get(i);
    if (rows) allRows.push(...rows);
  }

  return allRows;
}
