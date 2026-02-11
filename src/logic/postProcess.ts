import type { RawExtractedRow, PriceRow, PricingSettings } from '../types';
import { mergeAccessories } from './accessoryMerger';
import { applyMappings } from './articleMapping';
import { applyPricing } from './pricing';

/**
 * Full post-processing pipeline: AI rows -> final standardized PriceRow[].
 *
 * Steps:
 * 1. Merge duplicate accessories
 * 2. Convert raw rows to PriceRow format
 * 3. Apply article number mapping
 * 4. Apply pricing calculations
 * 5. Clean up empty values
 */
export function postProcess(
  rawRows: RawExtractedRow[],
  pricingSettings: PricingSettings,
  supplierName: string
): PriceRow[] {
  // 1. Merge accessories
  const merged = mergeAccessories(rawRows);

  // 2. Convert to PriceRow format
  let rows: PriceRow[] = merged.map((raw) => ({
    ertArtikelnr: raw.artikelnr.replace(/\s+/g, ''),
    vartArtikelnr: '', // Never filled by AI
    benamning: raw.benamning,
    varugrupp: raw.varugrupp,
    kortBeskrivning: raw.kortBeskrivning || '',
    ordPris: '',
    rabattProcent: '',
    nettoprisSEK: raw.pris,
    vikt: raw.vikt,
    volym: calculateVolume(raw.hojd, raw.bredd, raw.djup),
    hojd: raw.hojd || '',
    bredd: raw.bredd || '',
    djup: raw.djup || '',
    diameter: raw.diameter || '',
    helpall: raw.helpall || '',
    halvpall: raw.halvpall || '',
    pallkostnad: raw.pallkostnad,
    ralFarg: raw.ralFarg || '',
    fastFrakt: raw.fastFrakt || '',
    leveranstid: raw.leveranstid || '',
    ursprungsland: raw.ursprungsland || '',
    manualLank: raw.manualLank || '',
    produktLank: raw.produktLank || '',
  }));

  // 3. Apply article number mappings (supplier-aware)
  rows = applyMappings(rows, supplierName);

  // 4. Apply pricing
  rows = applyPricing(rows, pricingSettings);

  // 5. Clean up
  rows = rows.map(cleanRow);

  return rows;
}

/**
 * Calculate outer volume in m³ from dimensions in mm.
 * Formula: (höjd × bredd × djup) / 1 000 000 000
 */
function calculateVolume(hojd: string, bredd: string, djup: string): string {
  const h = parseMm(hojd);
  const b = parseMm(bredd);
  const d = parseMm(djup);
  if (!h || !b || !d) return '';
  const m3 = (h * b * d) / 1_000_000_000;
  // Show enough decimals to be meaningful (e.g. 0.072)
  return parseFloat(m3.toFixed(4)).toString();
}

/** Parse a mm value from a string, stripping units and handling commas. */
function parseMm(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Clean a row: ensure no dashes, trim values.
 */
function cleanRow(row: PriceRow): PriceRow {
  const clean = (v: string) => {
    const trimmed = v.trim();
    if (trimmed === '-' || trimmed === '–' || trimmed === '—' || trimmed === 'N/A') return '';
    return trimmed;
  };

  return {
    ertArtikelnr: clean(row.ertArtikelnr),
    vartArtikelnr: clean(row.vartArtikelnr),
    benamning: clean(row.benamning),
    varugrupp: clean(row.varugrupp),
    kortBeskrivning: clean(row.kortBeskrivning),
    ordPris: clean(row.ordPris),
    rabattProcent: clean(row.rabattProcent),
    nettoprisSEK: clean(row.nettoprisSEK),
    vikt: clean(row.vikt),
    volym: clean(row.volym),
    hojd: clean(row.hojd),
    bredd: clean(row.bredd),
    djup: clean(row.djup),
    diameter: clean(row.diameter),
    helpall: clean(row.helpall),
    halvpall: clean(row.halvpall),
    pallkostnad: clean(row.pallkostnad),
    ralFarg: clean(row.ralFarg),
    fastFrakt: clean(row.fastFrakt),
    leveranstid: clean(row.leveranstid),
    ursprungsland: clean(row.ursprungsland),
    manualLank: clean(row.manualLank),
    produktLank: clean(row.produktLank),
  };
}
