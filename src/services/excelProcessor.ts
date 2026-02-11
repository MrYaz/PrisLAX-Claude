import * as XLSX from 'xlsx';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractBatch, buildPrompt, type BatchTask } from './ai';

const NON_CATEGORY_NAMES = new Set([
  'info', 'villkor', 'blad1', 'blad2', 'blad3',
  'sheet1', 'sheet2', 'sheet3',
  'instruktioner', 'information', 'framsida',
  'översikt', 'sammanfattning', 'summary',
  'terms', 'conditions', 'notes', 'noteringar',
]);

const MAX_ROWS_PER_CHUNK = 80;
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

interface TextChunk {
  chunkIndex: number;
  sheetName: string;
  text: string;
  label: string;
  contextHint: string;
}

export async function processExcel(
  file: File,
  supplierHint: string,
  onProgress: (info: ProgressInfo) => void,
  signal: AbortSignal
): Promise<RawExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const totalSheets = sheetNames.length;

  const stats: ExtractionStats = {
    articlesFound: 0,
    accessoriesFound: 0,
    varugrupper: [],
    pageDetails: [],
  };

  onProgress({
    message: `Excel laddad: ${totalSheets} flikar`,
    current: 0,
    total: totalSheets,
    stats: { ...stats },
  });

  // ── Phase 1: Pre-parse all sheets into text chunks (fast, no API calls) ──
  const chunks: TextChunk[] = [];
  for (let i = 0; i < totalSheets; i++) {
    const sheetName = sheetNames[i];
    const sheet = workbook.Sheets[sheetName];
    const isLikelyCategory = !NON_CATEGORY_NAMES.has(sheetName.toLowerCase().trim());
    const sheetText = sheetToText(sheet);
    if (!sheetText.trim()) continue;

    const contextHint = buildContextHint(sheetName, isLikelyCategory, file.name);
    const lines = sheetText.split('\n');
    const headerLine = lines[0] || '';
    const dataLines = lines.slice(1);

    if (dataLines.length <= MAX_ROWS_PER_CHUNK) {
      chunks.push({
        chunkIndex: chunks.length,
        sheetName,
        text: sheetText,
        label: `Flik "${sheetName}"`,
        contextHint,
      });
    } else {
      const totalSubChunks = Math.ceil(dataLines.length / MAX_ROWS_PER_CHUNK);
      for (let c = 0; c < totalSubChunks; c++) {
        const start = c * MAX_ROWS_PER_CHUNK;
        const end = Math.min(start + MAX_ROWS_PER_CHUNK, dataLines.length);
        const chunkLines = [headerLine, ...dataLines.slice(start, end)];
        chunks.push({
          chunkIndex: chunks.length,
          sheetName,
          text: chunkLines.join('\n'),
          label: `Flik "${sheetName}" rad ${start + 1}–${end}`,
          contextHint,
        });
      }
    }
  }

  const totalChunks = chunks.length;
  if (totalChunks === 0) return [];

  if (signal.aborted) return [];

  // ── Phase 2: Send entire batch to worker ──
  const batchTasks: BatchTask[] = chunks.map((chunk) => ({
    taskId: chunk.chunkIndex,
    kind: 'text' as const,
    textContent: chunk.text,
    prompt: buildPrompt(supplierHint, chunk.contextHint),
    label: chunk.label,
  }));

  let completedCount = 0;
  const active = Math.min(CONCURRENCY, totalChunks);

  onProgress({
    message: `Analyserar ${totalChunks} delar (${active} parallellt i bakgrunden)...`,
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
      console.warn(`Chunk ${taskId} misslyckades: ${error.message}`);
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

  // Combine results in chunk order
  const allRows: RawExtractedRow[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const rows = resultsByChunk.get(i);
    if (rows) allRows.push(...rows);
  }

  if (signal.aborted) {
    onProgress({
      message: `Stoppad — ${completedCount} av ${totalChunks} delar behandlade`,
      current: completedCount,
      total: totalChunks,
      stats: { ...stats },
    });
  }

  return allRows;
}

function buildContextHint(sheetName: string, isLikelyCategory: boolean, fileName: string): string {
  let hint = `This data comes from an Excel file named "${fileName}", sheet "${sheetName}".`;

  if (isLikelyCategory) {
    hint += ` The sheet name "${sheetName}" likely indicates the product category (varugrupp). Use it as varugrupp unless the content clearly indicates otherwise.`;
  } else {
    hint += ` The sheet name "${sheetName}" does NOT look like a product category. Determine varugrupp from headings, product names, or patterns in the data.`;
  }

  hint += ` Look for offset accessory tables that may appear in side columns (e.g., columns E-H or I-L). These are accessories related to the main products and should be marked as isAccessory=true.`;

  return hint;
}

function sheetToText(sheet: XLSX.WorkSheet): string {
  const ref = sheet['!ref'];
  if (!ref) return '';

  const range = XLSX.utils.decode_range(ref);
  const lines: string[] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      cells.push(cell ? String(cell.v ?? '') : '');
    }
    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}
