import type { RawExtractedRow, PriceRow, PricingSettings, SpecialPriceData } from '../types';
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
 * 5. Apply special prices (if uploaded)
 * 6. Clean up empty values
 */
export function postProcess(
  rawRows: RawExtractedRow[],
  pricingSettings: PricingSettings,
  supplierName: string,
  specialPrices?: SpecialPriceData | null
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
    hasSpecialPrice: false,
  }));

  // 3. Apply article number mappings (supplier-aware)
  rows = applyMappings(rows, supplierName);

  // 4. Apply pricing
  rows = applyPricing(rows, pricingSettings);

  // 5. Apply special prices (override nettopris for matched articles)
  if (specialPrices && specialPrices.entries.length > 0) {
    rows = applySpecialPrices(rows, specialPrices, pricingSettings.specialPriceDiscount);
  }

  // 6. Clean up
  rows = rows.map(cleanRow);

  return rows;
}

/**
 * Apply special prices to matching rows.
 *
 * For each row, check if its article number matches a special price entry.
 * If so: override nettopris with the special price, apply optional discount,
 * and mark the row.
 */
function applySpecialPrices(
  rows: PriceRow[],
  specialPrices: SpecialPriceData,
  discountPct: number
): PriceRow[] {
  // Build a lookup map: normalized article number -> special price
  const priceMap = new Map<string, number>();
  for (const entry of specialPrices.entries) {
    priceMap.set(normalizeArt(entry.artikelnr), entry.price);
  }

  return rows.map((row) => {
    const key = normalizeArt(row.ertArtikelnr);
    if (!key) return row;

    const specialPrice = priceMap.get(key);
    if (specialPrice === undefined) return row;

    // Calculate discounted special price
    const afterDiscount = discountPct > 0
      ? specialPrice * (1 - discountPct / 100)
      : specialPrice;

    const finalPrice = Math.round(afterDiscount);

    // ordPris shows the special list price (before our discount)
    // nettopris shows the final price after discount
    return {
      ...row,
      ordPris: row.ordPris || String(Math.round(specialPrice)),
      nettoprisSEK: String(finalPrice),
      hasSpecialPrice: true,
    };
  });
}

/** Normalize article number for matching: lowercase, no spaces, no trailing * */
function normalizeArt(art: string): string {
  return art.toLowerCase().replace(/\s+/g, '').replace(/\*+$/, '');
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
    hasSpecialPrice: row.hasSpecialPrice,
  };
}
