import type { ArticleMapping, PriceRow } from '../types';

let baseMappings: ArticleMapping[] = [];
let userMappings: ArticleMapping[] = [];

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

export function setUserMappings(mappings: ArticleMapping[]): void {
  userMappings = mappings;
}

export function clearUserMappings(): void {
  userMappings = [];
}

export function parseMappingCsv(csvText: string): ArticleMapping[] {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());

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
 * When a supplierName is given, mappings for that supplier are tried first
 * (exact match on supplier + article number), then fallback to all mappings.
 *
 * Strategy:
 * 1. Exact match on supplier + supplier article number
 * 2. Exact match on supplier article number (any supplier)
 * 3. Match on product name
 * 4. Leave empty if no match
 */
export function applyMappings(rows: PriceRow[], supplierName: string): PriceRow[] {
  const combined = buildMappingIndex(supplierName);

  return rows.map((row) => {
    if (row.vartArtikelnr) return row;

    const artKey = normalizeArtNr(row.ertArtikelnr);

    // 1. Match on supplier-specific article number
    if (artKey) {
      const bySupplierArt = combined.bySupplierSpecificArt.get(artKey);
      if (bySupplierArt) {
        return { ...row, vartArtikelnr: bySupplierArt };
      }

      // 2. Match on article number (any supplier)
      const byArt = combined.bySupplierArt.get(artKey);
      if (byArt) {
        return { ...row, vartArtikelnr: byArt };
      }
    }

    // 3. Match on product name
    if (row.benamning) {
      const nameLower = row.benamning.toLowerCase();
      for (const [mapName, internArt] of combined.byName) {
        if (nameLower.includes(mapName) || mapName.includes(nameLower)) {
          return { ...row, vartArtikelnr: internArt };
        }
      }
    }

    return row;
  });
}

/**
 * Partial supplier name match: "Profsafe" matches "Profsafe AB",
 * "Business To Nordic" matches "BTN AB", etc.
 * Both directions checked (contains).
 */
function supplierMatches(mappingSupplier: string, selectedSupplier: string): boolean {
  if (!mappingSupplier || !selectedSupplier) return false;
  const a = mappingSupplier.toLowerCase().trim();
  const b = selectedSupplier.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Normalize an article number for flexible matching.
 * Strips common suffixes/noise: trailing *, whitespace, dashes at end.
 */
function normalizeArtNr(art: string): string {
  return art.toLowerCase().replace(/[\s*]+$/g, '').trim();
}

function buildMappingIndex(supplierName: string): {
  bySupplierSpecificArt: Map<string, string>;
  bySupplierArt: Map<string, string>;
  byName: Map<string, string>;
} {
  const bySupplierSpecificArt = new Map<string, string>();
  const bySupplierArt = new Map<string, string>();
  const byName = new Map<string, string>();

  function indexMapping(m: ArticleMapping): void {
    if (m.supplierArtikelnr) {
      const key = normalizeArtNr(m.supplierArtikelnr);
      bySupplierArt.set(key, m.internArtikelnr);
      if (supplierName && supplierMatches(m.supplier, supplierName)) {
        bySupplierSpecificArt.set(key, m.internArtikelnr);
      }
    }
    if (m.productName) {
      byName.set(m.productName.toLowerCase(), m.internArtikelnr);
    }
  }

  // Base mappings first, then user mappings override
  for (const m of baseMappings) indexMapping(m);
  for (const m of userMappings) indexMapping(m);

  return { bySupplierSpecificArt, bySupplierArt, byName };
}
