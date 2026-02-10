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
 * Ord. pris = basePrice * exchangeRate (shown when discount or adjustment applied)
 * Rabatt % = dealerDiscount (shown when > 0)
 * Nettopris = final price after all calculations
 *
 * All prices are shown as integers (no decimals).
 */
export function applyPricing(
  rows: PriceRow[],
  settings: PricingSettings
): PriceRow[] {
  const hasDiscount = settings.dealerDiscount > 0;
  const hasAdjustment = settings.priceAdjustment !== 0;
  const hasExchangeRate = settings.exchangeRate !== 1;
  const hasPricingChanges = hasDiscount || hasAdjustment || hasExchangeRate;

  return rows.map((row) => {
    const basePrice = parsePrice(row.nettoprisSEK || row.ordPris);
    if (isNaN(basePrice) || basePrice === 0) return row;

    const originalInSEK = basePrice * settings.exchangeRate;
    const afterDiscount = basePrice * (1 - settings.dealerDiscount / 100);
    const afterAdjustment = afterDiscount * (1 + settings.priceAdjustment / 100);
    const nettopris = afterAdjustment * settings.exchangeRate;

    // Round to integers
    const nettoprisRounded = Math.round(nettopris);
    const originalRounded = Math.round(originalInSEK);

    // Show Ord. pris when pricing changes are applied and prices differ
    const showOriginal = hasPricingChanges && Math.abs(originalRounded - nettoprisRounded) >= 1;

    return {
      ...row,
      ordPris: showOriginal ? formatPrice(originalRounded) : '',
      rabattProcent: hasDiscount ? String(settings.dealerDiscount) : '',
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
  return String(value);
}
