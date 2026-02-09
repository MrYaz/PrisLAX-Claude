import * as XLSX from 'xlsx';
import type { ArticleMapping } from '../types';
import { parseMappingCsv } from '../logic/articleMapping';

/**
 * Parse an uploaded mapping file (CSV or Excel) into ArticleMapping entries.
 */
export async function parseMappingFile(file: File): Promise<ArticleMapping[]> {
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return parseMappingCsv(text);
  }

  // Excel
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to CSV and parse
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
  return parseMappingCsv(csv);
}
