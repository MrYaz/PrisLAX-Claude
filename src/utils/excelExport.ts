import ExcelJS from 'exceljs';
import type { PriceRow } from '../types';
import { OUTPUT_COLUMNS } from '../types';

/**
 * Pastel colors for each column in the Excel export.
 * Grouped by category for visual clarity.
 */
const COLUMN_COLORS: Record<string, string> = {
  // Identifiers — light blue
  'Ert artikelnr': 'FFD6EAF8',
  'Vårt artikelnr': 'FFD6EAF8',
  // Product info — light green
  'Benämning': 'FFD5F5E3',
  'Varugrupp': 'FFD5F5E3',
  'Kort beskrivning': 'FFD5F5E3',
  // Pricing — light peach/salmon
  'Ord. pris': 'FFFDEBD0',
  'Rabatt %': 'FFFDEBD0',
  'Nettopris (SEK)': 'FFFDEBD0',
  // Physical — light purple
  'Vikt (kg)': 'FFE8DAEF',
  'Volym (m3)': 'FFE8DAEF',
  'Höjd (mm)': 'FFE8DAEF',
  'Bredd (mm)': 'FFE8DAEF',
  'Djup (mm)': 'FFE8DAEF',
  'Diameter (mm)': 'FFE8DAEF',
  // Logistics — light yellow
  'Helpall': 'FFFEF9E7',
  'Halvpall': 'FFFEF9E7',
  'Pallkostnad': 'FFFEF9E7',
  'RAL-färg': 'FFFEF9E7',
  'Fast frakt (kr)': 'FFFEF9E7',
  'Leveranstid (dagar)': 'FFFEF9E7',
  'Ursprungsland': 'FFFEF9E7',
  // Links — light pink
  'Manual-länk': 'FFFADBD8',
  'Produktlänk': 'FFFADBD8',
};

/**
 * Map PriceRow to array of cell values in OUTPUT_COLUMNS order.
 */
function rowToArray(row: PriceRow): (string | number)[] {
  return [
    row.ertArtikelnr,
    row.vartArtikelnr,
    row.benamning,
    row.varugrupp,
    row.kortBeskrivning,
    numericOrEmpty(row.ordPris),
    row.rabattProcent ? Number(row.rabattProcent) : '',
    numericOrEmpty(row.nettoprisSEK),
    row.vikt,
    row.volym,
    row.hojd,
    row.bredd,
    row.djup,
    row.diameter,
    row.helpall,
    row.halvpall,
    row.pallkostnad,
    row.ralFarg,
    row.fastFrakt,
    row.leveranstid,
    row.ursprungsland,
    row.manualLank,
    row.produktLank,
  ];
}

/** Convert price string to number for Excel, or return empty string */
function numericOrEmpty(val: string): number | string {
  if (!val) return '';
  const num = Number(val);
  return isNaN(num) ? val : num;
}

/**
 * Export price rows to a formatted .xlsx file.
 * - Bold header row with pastel colors per column category
 * - Correct Swedish characters (UTF-8)
 * - 23 columns in exact order
 */
export async function exportToExcel(rows: PriceRow[], fileName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PrisLAX';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Prislista');

  // Add header row
  const headerRow = sheet.addRow([...OUTPUT_COLUMNS]);
  headerRow.font = { bold: true, size: 10 };
  headerRow.eachCell((cell, colNumber) => {
    const colName = OUTPUT_COLUMNS[colNumber - 1];
    const bgColor = COLUMN_COLORS[colName] || 'FFE0E0E0';
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    };
    cell.border = {
      bottom: { style: 'thin' },
    };
    cell.alignment = { vertical: 'middle' };
  });

  // Add data rows with alternating tint for the same pastel groups
  for (const row of rows) {
    const dataRow = sheet.addRow(rowToArray(row));
    dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const colName = OUTPUT_COLUMNS[colNumber - 1];
      const bgColor = COLUMN_COLORS[colName];
      if (bgColor) {
        // Lighter version for data rows (add more white)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: lightenColor(bgColor) },
        };
      }
    });
  }

  // Auto-width columns
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = len;
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Make a pastel color even lighter for data rows.
 * Takes an ARGB hex string and blends toward white.
 */
function lightenColor(argb: string): string {
  const r = parseInt(argb.substring(2, 4), 16);
  const g = parseInt(argb.substring(4, 6), 16);
  const b = parseInt(argb.substring(6, 8), 16);
  const blend = 0.5;
  const lr = Math.round(r + (255 - r) * blend);
  const lg = Math.round(g + (255 - g) * blend);
  const lb = Math.round(b + (255 - b) * blend);
  return `FF${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}
