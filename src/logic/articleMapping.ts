import type { ArticleMapping, PriceRow } from '../types';

let baseMappings: ArticleMapping[] = [];
let userMappings: ArticleMapping[] = [];

/**
 * Load the base mapping CSV from /public/data/sammanstalld_artikellista.csv
 */
export async function loadBaseMappings(): Promise<void> {
  try {
    const response = await fetch('/data/sammanstalld_artikellista.csv');
    if (!response.ok) {
      console.warn('Base mapping file not found, continuing without it.');
      return;
    }
    const text = await response.text();
    baseMappings = parseMappingCsv(text);
  } catch (err) {
    console.warn('Could not load base mapping file:', err);
  }
}

/**
 * Parse mapping from a CSV/Excel file uploaded by the user.
 * Expected columns: supplier article number, internal article number, product name
 * (flexible column detection)
 */
export function setUserMappings(mappings: ArticleMapping[]): void {
  userMappings = mappings;
}

export function clearUserMappings(): void {
  userMappings = [];
}

/**
 * Parse a CSV string into ArticleMapping entries.
 * Tries to detect columns by header names.
 */
export function parseMappingCsv(csvText: string): ArticleMapping[] {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());

  // Find column indices by common header names
  const supplierCol = findColumn(headers, [
    'leverantör', 'leverantor', 'supplier', 'lev',
  ]);
  const supplierArtCol = findColumn(headers, [
    'ert artikelnr', 'ert artikelr', 'ert art', 'leverantör artikelnr',
    'lev artikelnr', 'supplier article', 'lev art.nr', 'lev artnr',
    'artikelnr leverantör', 'ert art.nr', 'ert artnr',
  ]);
  const internArtCol = findColumn(headers, [
    'vårt artikelnr', 'vart artikelnr', 'vårt art', 'internt artikelnr',
    'intern artikelnr', 'internal article', 'vårt art.nr', 'vårt artnr',
    'artikelnr', 'art.nr', 'artnr',
  ]);
  const nameCol = findColumn(headers, [
    'benämning', 'benamning', 'namn', 'name', 'produkt', 'product',
    'beskrivning', 'description',
  ]);

  if (internArtCol === -1) {
    console.warn('Could not find internal article number column in mapping file');
    return [];
  }

  // If no explicit supplier article column, use the first "artikelnr"-like column
  // that is NOT the internal one
  const effectiveSupplierArtCol =
    supplierArtCol !== -1 ? supplierArtCol : findAlternativeArtCol(headers, internArtCol);

  const mappings: ArticleMapping[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const internArt = cols[internArtCol]?.trim() || '';
    if (!internArt) continue;

    mappings.push({
      supplier: supplierCol !== -1 ? cols[supplierCol]?.trim() || '' : '',
      supplierArtikelnr: effectiveSupplierArtCol !== -1 ? cols[effectiveSupplierArtCol]?.trim() || '' : '',
      internArtikelnr: internArt,
      productName: nameCol !== -1 ? cols[nameCol]?.trim() || '' : '',
    });
  }

  return mappings;
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function findAlternativeArtCol(headers: string[], excludeCol: number): number {
  for (let i = 0; i < headers.length; i++) {
    if (i === excludeCol) continue;
    if (headers[i].includes('art') || headers[i].includes('nr') || headers[i].includes('sku')) {
      return i;
    }
  }
  return -1;
}

/**
 * Apply article number mapping to a list of price rows.
 * User mappings override base mappings.
 *
 * Strategy:
 * 1. Exact match on supplier article number (ertArtikelnr)
 * 2. Fuzzy match on product name (benamning)
 * 3. Leave empty if no match
 */
export function applyMappings(rows: PriceRow[]): PriceRow[] {
  // Merge mappings: user overrides base
  const combined = buildMappingIndex();

  return rows.map((row) => {
    if (row.vartArtikelnr) return row; // Already mapped

    // 1. Exact match on supplier article number
    const byArt = combined.bySupplierArt.get(row.ertArtikelnr.toLowerCase());
    if (byArt) {
      return { ...row, vartArtikelnr: byArt };
    }

    // 2. Match on product name (case-insensitive contains)
    if (row.benamning) {
      const nameLower = row.benamning.toLowerCase();
      for (const [mapName, internArt] of combined.byName) {
        if (nameLower.includes(mapName) || mapName.includes(nameLower)) {
          return { ...row, vartArtikelnr: internArt };
        }
      }
    }

    // 3. No match
    return row;
  });
}

function buildMappingIndex(): {
  bySupplierArt: Map<string, string>;
  byName: Map<string, string>;
} {
  const bySupplierArt = new Map<string, string>();
  const byName = new Map<string, string>();

  // Base mappings first
  for (const m of baseMappings) {
    if (m.supplierArtikelnr) {
      bySupplierArt.set(m.supplierArtikelnr.toLowerCase(), m.internArtikelnr);
    }
    if (m.productName) {
      byName.set(m.productName.toLowerCase(), m.internArtikelnr);
    }
  }

  // User mappings override
  for (const m of userMappings) {
    if (m.supplierArtikelnr) {
      bySupplierArt.set(m.supplierArtikelnr.toLowerCase(), m.internArtikelnr);
    }
    if (m.productName) {
      byName.set(m.productName.toLowerCase(), m.internArtikelnr);
    }
  }

  return { bySupplierArt, byName };
}
