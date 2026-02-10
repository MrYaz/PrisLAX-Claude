import * as XLSX from 'xlsx';
import type { RawExtractedRow, ProgressInfo, ExtractionStats } from '../types';
import { extractFromText } from './ai';

const NON_CATEGORY_NAMES = new Set([
  'info', 'villkor', 'blad1', 'blad2', 'blad3',
  'sheet1', 'sheet2', 'sheet3',
  'instruktioner', 'information', 'framsida',
  'översikt', 'sammanfattning', 'summary',
  'terms', 'conditions', 'notes', 'noteringar',
]);

const MAX_ROWS_PER_CHUNK = 80;

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

  const allRows: RawExtractedRow[] = [];
  let hasSucceeded = false;
  let errorCount = 0;

  for (let i = 0; i < totalSheets; i++) {
    if (signal.aborted) {
      onProgress({
        message: `Stoppad efter flik ${i} av ${totalSheets}`,
        current: i,
        total: totalSheets,
        stats: { ...stats },
      });
      break;
    }

    const sheetName = sheetNames[i];
    const sheet = workbook.Sheets[sheetName];

    onProgress({
      message: `Behandlar flik "${sheetName}" (${i + 1} av ${totalSheets})`,
      current: i,
      total: totalSheets,
      stats: { ...stats },
    });

    const isLikelyCategory = !NON_CATEGORY_NAMES.has(sheetName.toLowerCase().trim());
    const sheetText = sheetToText(sheet);

    if (!sheetText.trim()) continue;

    const processChunk = async (text: string, label: string) => {
      const contextHint = buildContextHint(sheetName, isLikelyCategory, file.name);
      try {
        const rows = await extractFromText(text, supplierHint, contextHint);
        allRows.push(...rows);
        hasSucceeded = true;
        updateStats(stats, rows, label);
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        if (!hasSucceeded) {
          throw new Error(`AI-anrop misslyckades (${label}): ${msg}`);
        }
        console.warn(`${label} misslyckades, fortsätter: ${msg}`);
      }
    };

    const lines = sheetText.split('\n');
    const headerLine = lines[0] || '';
    const dataLines = lines.slice(1);

    if (dataLines.length <= MAX_ROWS_PER_CHUNK) {
      await processChunk(sheetText, `Flik "${sheetName}"`);
    } else {
      const totalChunks = Math.ceil(dataLines.length / MAX_ROWS_PER_CHUNK);
      for (let c = 0; c < totalChunks; c++) {
        if (signal.aborted) break;

        const start = c * MAX_ROWS_PER_CHUNK;
        const end = Math.min(start + MAX_ROWS_PER_CHUNK, dataLines.length);
        const chunkLines = [headerLine, ...dataLines.slice(start, end)];
        const chunkText = chunkLines.join('\n');

        onProgress({
          message: `Behandlar flik "${sheetName}" rad ${start + 1}–${end} (av ${dataLines.length})`,
          current: i,
          total: totalSheets,
          stats: { ...stats },
        });

        await processChunk(chunkText, `Flik "${sheetName}" rad ${start + 1}–${end}`);
      }
    }

    if (!signal.aborted) {
      onProgress({
        message: `Flik "${sheetName}" klar (${i + 1} av ${totalSheets})`,
        current: i + 1,
        total: totalSheets,
        stats: { ...stats },
      });
    }
  }

  if (errorCount > 0) {
    console.warn(`Excel-behandling klar med ${errorCount} misslyckade delar`);
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
