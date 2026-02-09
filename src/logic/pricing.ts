import type { PricingSettings, PriceRow } from '../types';

/**
 * Apply pricing calculations to all rows.
 *
 * Formula:
 *   basePrice = parsed pris from extraction
 *   afterDiscount = basePrice * (1 - dealerDiscount/100)
 *   afterAdjustment = afterDiscount * (1 + priceAdjustment/100)
 *   nettopris = afterAdjustment * exchangeRate
 *
 * Originalpris = basePrice * exchangeRate (only shown if different from nettopris)
 */
export function applyPricing(
  rows: PriceRow[],
  settings: PricingSettings
): PriceRow[] {
  return rows.map((row) => {
    const basePrice = parsePrice(row.nettoprisSEK || row.originalpris);
    if (isNaN(basePrice) || basePrice === 0) return row;

    const originalInSEK = basePrice * settings.exchangeRate;
    const afterDiscount = basePrice * (1 - settings.dealerDiscount / 100);
    const afterAdjustment = afterDiscount * (1 + settings.priceAdjustment / 100);
    const nettopris = afterAdjustment * settings.exchangeRate;

    // Round to 2 decimals
    const nettoprisRounded = Math.round(nettopris * 100) / 100;
    const originalRounded = Math.round(originalInSEK * 100) / 100;

    // Originalpris empty if same as nettopris
    const showOriginal =
      Math.abs(originalRounded - nettoprisRounded) > 0.01;

    return {
      ...row,
      originalpris: showOriginal ? formatPrice(originalRounded) : '',
      nettoprisSEK: formatPrice(nettoprisRounded),
    };
  });
}

function parsePrice(value: string): number {
  if (!value) return 0;
  // Remove spaces, replace comma with dot
  const cleaned = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function formatPrice(value: number): string {
  if (value === 0) return '';
  // Format with 2 decimals, using dot as decimal separator
  return value.toFixed(2);
}
