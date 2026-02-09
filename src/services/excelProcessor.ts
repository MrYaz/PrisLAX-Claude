import * as XLSX from 'xlsx';
import type { RawExtractedRow, ProgressInfo } from '../types';
import { extractFromText } from './ai';

/** Sheet names that are clearly NOT product categories */
const NON_CATEGORY_NAMES = new Set([
  'info', 'villkor', 'blad1', 'blad2', 'blad3',
  'sheet1', 'sheet2', 'sheet3',
  'instruktioner', 'information', 'framsida',
  'översikt', 'sammanfattning', 'summary',
  'terms', 'conditions', 'notes', 'noteringar',
]);

const MAX_ROWS_PER_CHUNK = 80;

/**
 * Process an Excel file: iterate sheets, convert to text, extract via AI.
 */
export async function processExcel(
  file: File,
  onProgress: (info: ProgressInfo) => void
): Promise<RawExtractedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const totalSheets = sheetNames.length;

  onProgress({
    message: `Excel laddad: ${totalSheets} flikar`,
    current: 0,
    total: totalSheets,
  });

  const allRows: RawExtractedRow[] = [];

  for (let i = 0; i < totalSheets; i++) {
    const sheetName = sheetNames[i];
    const sheet = workbook.Sheets[sheetName];

    onProgress({
      message: `Behandlar flik "${sheetName}" (${i + 1} av ${totalSheets})`,
      current: i,
      total: totalSheets,
    });

    const isLikelyCategory = !NON_CATEGORY_NAMES.has(sheetName.toLowerCase().trim());
    const sheetText = sheetToText(sheet);

    if (!sheetText.trim()) continue; // Skip empty sheets

    // Chunk large sheets
    const lines = sheetText.split('\n');
    const headerLine = lines[0] || '';
    const dataLines = lines.slice(1);

    if (dataLines.length <= MAX_ROWS_PER_CHUNK) {
      // Small enough to process in one go
      const contextHint = buildContextHint(sheetName, isLikelyCategory, file.name);
      try {
        const rows = await extractFromText(sheetText, contextHint);
        allRows.push(...rows);
      } catch (err) {
        console.error(`Error extracting from sheet "${sheetName}":`, err);
      }
    } else {
      // Chunk large sheet
      const totalChunks = Math.ceil(dataLines.length / MAX_ROWS_PER_CHUNK);
      for (let c = 0; c < totalChunks; c++) {
        const start = c * MAX_ROWS_PER_CHUNK;
        const end = Math.min(start + MAX_ROWS_PER_CHUNK, dataLines.length);
        const chunkLines = [headerLine, ...dataLines.slice(start, end)];
        const chunkText = chunkLines.join('\n');

        onProgress({
          message: `Behandlar flik "${sheetName}" rad ${start + 1}–${end} (av ${dataLines.length})`,
          current: i,
          total: totalSheets,
        });

        const contextHint = buildContextHint(sheetName, isLikelyCategory, file.name);
        try {
          const rows = await extractFromText(chunkText, contextHint);
          allRows.push(...rows);
        } catch (err) {
          console.error(`Error extracting chunk ${c + 1} from sheet "${sheetName}":`, err);
        }
      }
    }

    onProgress({
      message: `Flik "${sheetName}" klar (${i + 1} av ${totalSheets})`,
      current: i + 1,
      total: totalSheets,
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

/**
 * Convert a sheet to a tab-separated text representation.
 * Preserves layout structure so AI can understand the spatial arrangement.
 */
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
