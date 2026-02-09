import ExcelJS from 'exceljs';
import type { PriceRow } from '../types';
import { OUTPUT_COLUMNS } from '../types';

/**
 * Export price rows to a formatted .xlsx file.
 * - Bold header row
 * - Correct Swedish characters (UTF-8)
 * - Exact column order as specified
 */
export async function exportToExcel(rows: PriceRow[], fileName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PrisLAX';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Prislista');

  // Add header row
  const headerRow = sheet.addRow([...OUTPUT_COLUMNS]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });

  // Add data rows
  for (const row of rows) {
    sheet.addRow([
      row.ertArtikelnr,
      row.vartArtikelnr,
      row.varugrupp,
      row.benamning,
      row.vikt,
      row.volym,
      row.pallkostnad,
      row.originalpris,
      row.nettoprisSEK,
    ]);
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
