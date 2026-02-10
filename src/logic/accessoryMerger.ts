import type { RawExtractedRow } from '../types';

/**
 * Merge duplicate accessories that differ only in which main products they fit.
 *
 * If the same accessory (same artikelnr + benamning) appears multiple times
 * with different fitsProducts, combine them into one row with a merged name like:
 * "Elkodlås 1 + 1 kod till SA210, SA390, SA310, SA580 och SA990"
 *
 * Also ensures all accessories have varugrupp = "Tillbehör".
 */
export function mergeAccessories(rows: RawExtractedRow[]): RawExtractedRow[] {
  const nonAccessories: RawExtractedRow[] = [];
  const accessoryMap = new Map<string, RawExtractedRow & { allFitsProducts: Set<string> }>();

  for (const row of rows) {
    if (!row.isAccessory) {
      nonAccessories.push(row);
      continue;
    }

    // Ensure varugrupp is Tillbehör
    const withGroup = { ...row, varugrupp: 'Tillbehör' };

    // Create a key based on article number + base name
    const key = makeAccessoryKey(withGroup);
    const existing = accessoryMap.get(key);

    if (existing) {
      // Merge fitsProducts
      for (const p of withGroup.fitsProducts) {
        if (p) existing.allFitsProducts.add(p);
      }
      // Keep the better price (non-empty)
      if (!existing.pris && withGroup.pris) {
        existing.pris = withGroup.pris;
      }
    } else {
      const allFitsProducts = new Set<string>();
      for (const p of withGroup.fitsProducts) {
        if (p) allFitsProducts.add(p);
      }
      accessoryMap.set(key, { ...withGroup, allFitsProducts });
    }
  }

  // Convert merged accessories back to rows with formatted names
  const mergedAccessories: RawExtractedRow[] = [];
  for (const acc of accessoryMap.values()) {
    const baseName = getBaseName(acc.benamning);
    const products = Array.from(acc.allFitsProducts);

    let finalName = baseName;
    if (products.length > 0) {
      const productList = formatProductList(products);
      finalName = `${baseName} till ${productList}`;
    }

    mergedAccessories.push({
      artikelnr: acc.artikelnr,
      benamning: finalName,
      varugrupp: 'Tillbehör',
      kortBeskrivning: acc.kortBeskrivning,
      vikt: acc.vikt,
      volym: acc.volym,
      hojd: acc.hojd,
      bredd: acc.bredd,
      djup: acc.djup,
      diameter: acc.diameter,
      helpall: acc.helpall,
      halvpall: acc.halvpall,
      pallkostnad: acc.pallkostnad,
      ralFarg: acc.ralFarg,
      fastFrakt: acc.fastFrakt,
      leveranstid: acc.leveranstid,
      ursprungsland: acc.ursprungsland,
      manualLank: acc.manualLank,
      produktLank: acc.produktLank,
      pris: acc.pris,
      isAccessory: true,
      fitsProducts: products,
    });
  }

  return [...nonAccessories, ...mergedAccessories];
}

/**
 * Create a stable key for grouping the same accessory.
 * Uses article number if available, otherwise normalised name.
 */
function makeAccessoryKey(row: RawExtractedRow): string {
  if (row.artikelnr) {
    return `art:${row.artikelnr.toLowerCase().trim()}`;
  }
  return `name:${row.benamning.toLowerCase().trim().replace(/\s+/g, ' ')}`;
}

/**
 * Strip any existing "till ..." suffix from a name.
 */
function getBaseName(name: string): string {
  return name.replace(/\s+till\s+.+$/i, '').trim();
}

/**
 * Format a list of products in Swedish style:
 * ["SA210", "SA390", "SA310"] -> "SA210, SA390 och SA310"
 */
function formatProductList(products: string[]): string {
  if (products.length === 0) return '';
  if (products.length === 1) return products[0];

  const sorted = [...products].sort();
  const last = sorted.pop()!;
  return sorted.join(', ') + ' och ' + last;
}
