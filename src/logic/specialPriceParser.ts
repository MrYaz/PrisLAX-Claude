import * as XLSX from 'xlsx';
import type { SpecialPriceData, SpecialPriceEntry } from '../types';

/**
 * Parse a special price file (Excel/CSV) into structured data.
 *
 * Flexibly detects columns by header name patterns:
 * - Article number: "kodfält", "artikelnr", "artikel", "art.nr", "artnr", "kod"
 * - Price: "nytt pris", "avtalspris", "specialpris", "nettopris", "pris"
 * - General discount: row where article column contains "rabatt" + "övrigt" / "sortiment"
 */
export async function parseSpecialPriceFile(file: File): Promise<SpecialPriceData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Filen innehåller inga flikar.');

  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'];
  if (!ref) throw new Error('Fliken är tom.');

  const range = XLSX.utils.decode_range(ref);

  // Read header row
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    headers.push(cell ? String(cell.v ?? '').trim() : '');
  }

  // Detect columns
  const artCol = findColumn(headers, [
    /kodfält/i, /artikelnr/i, /art\.?\s*nr/i, /artnr/i, /artikel/i, /kod/i, /product\s*code/i,
  ]);
  const priceCol = findPriceColumn(headers);
  const discountCol = findColumn(headers, [
    /rabatt/i, /påslag/i, /discount/i,
  ]);

  if (artCol === -1) {
    throw new Error(
      `Kunde inte hitta artikelnummer-kolumn. Hittade kolumnrubriker: ${headers.filter(Boolean).join(', ')}`
    );
  }
  if (priceCol === -1) {
    throw new Error(
      `Kunde inte hitta pris-kolumn. Hittade kolumnrubriker: ${headers.filter(Boolean).join(', ')}`
    );
  }

  // Parse rows
  const entries: SpecialPriceEntry[] = [];
  let generalDiscount = 0;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const artCell = sheet[XLSX.utils.encode_cell({ r, c: artCol })];
    const priceCell = sheet[XLSX.utils.encode_cell({ r, c: priceCol })];
    const discountCell = discountCol >= 0
      ? sheet[XLSX.utils.encode_cell({ r, c: discountCol })]
      : undefined;

    const artValue = artCell ? String(artCell.v ?? '').trim() : '';
    const priceValue = priceCell ? parseNumber(priceCell.v) : 0;
    const discountValue = discountCell ? parseNumber(discountCell.v) : 0;

    // Check if this is the general discount row ("Rabatt på övrigt sortiment")
    if (isGeneralDiscountRow(artValue, r, range.s.r)) {
      if (discountValue > 0) {
        generalDiscount = discountValue;
      } else if (priceValue > 0 && priceValue <= 100) {
        // Sometimes the % is in the price column
        generalDiscount = priceValue;
      }
      continue;
    }

    // Skip rows without article number
    if (!artValue) continue;

    // Normalize article number (strip spaces, trailing *)
    const artikelnr = artValue.replace(/\s+/g, '').replace(/\*+$/, '');
    if (!artikelnr) continue;

    if (priceValue > 0) {
      entries.push({ artikelnr, price: priceValue });
    }
  }

  return { entries, generalDiscount };
}

/**
 * Find the best price column — prefer "nytt pris" over generic "pris".
 */
function findPriceColumn(headers: string[]): number {
  // Priority order: specific new/agreement price first
  const priorityPatterns = [
    /nytt\s*pris/i,
    /avtalspris/i,
    /specialpris/i,
    /nettopris/i,
  ];
  for (const pattern of priorityPatterns) {
    const idx = headers.findIndex((h) => pattern.test(h));
    if (idx >= 0) return idx;
  }
  // Fallback: rightmost column containing "pris"
  for (let i = headers.length - 1; i >= 0; i--) {
    if (/pris/i.test(headers[i])) return i;
  }
  return -1;
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function isGeneralDiscountRow(artValue: string, _row: number, _headerRow: number): boolean {
  const lower = artValue.toLowerCase();
  return (
    (lower.includes('rabatt') && (lower.includes('övrigt') || lower.includes('sortiment'))) ||
    lower.includes('övriga artiklar') ||
    lower.includes('generell rabatt')
  );
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/\s/g, '').replace(',', '.').replace(/[^\d.%-]/g, '');
  // Handle percentage strings like "45%"
  const pctMatch = str.match(/^([\d.]+)%$/);
  if (pctMatch) return parseFloat(pctMatch[1]) || 0;
  return parseFloat(str) || 0;
}
