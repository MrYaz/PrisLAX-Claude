import type { SupplierProfile } from '../types';

/**
 * Supplier-specific extraction profiles.
 *
 * Each profile contains hints that guide the AI when extracting product data.
 * Hints describe the layout, naming conventions, and structure typical of
 * that supplier's price lists so the AI knows what to look for.
 *
 * To add a new supplier: add an entry here with id, name, and extraction hints.
 * The hints are appended to the extraction prompt for the matching supplier + file type.
 */
export const SUPPLIER_PROFILES: SupplierProfile[] = [
  {
    id: 'profsafe',
    name: 'Profsafe',
    defaultHint: `This is a Profsafe price list. Profsafe sells security cabinets, safes, and related accessories.
Product categories often include: Säkerhetsskåp, Dokumentskåp, Brandskåp, Vapenskåp, Nyckelskåp.
Accessories include things like: locks (kodlås, nyckellås, elkodlås), shelves (hyllor), holders, brackets.`,
    extractionHints: {
      pdf: `Profsafe PDFs are often matrix-style price lists.
Columns represent main product models (e.g., SA210, SA310, SA390).
Rows represent accessories or options with prices at each intersection.
Each intersection with a price is a separate article.
The main products typically appear as column headers with their article numbers.
Accessories appear as row labels on the left side.
Extract EVERY price cell in the matrix as a separate row.
Mark intersection rows as accessories (isAccessory=true) and include ALL column headers they belong to in fitsProducts.`,
      excel: `Profsafe Excel files often have one sheet per product category.
The sheet name IS the product category (varugrupp).
Main products are listed with article numbers, names, dimensions, weights, and prices.
Look for offset accessory tables in side columns (E-H or further right).
These offset tables list accessories that belong to the main products on the same sheet.`,
    },
  },
  {
    id: 'generic',
    name: 'Övrig leverantör',
    defaultHint: '',
    extractionHints: {},
  },
];

/**
 * Get supplier profile by ID, falling back to generic.
 */
export function getSupplierProfile(supplierId: string): SupplierProfile {
  return (
    SUPPLIER_PROFILES.find((s) => s.id === supplierId) ??
    SUPPLIER_PROFILES.find((s) => s.id === 'generic')!
  );
}

/**
 * Get the extraction hint for a specific supplier + file type combination.
 */
export function getExtractionHint(
  supplierId: string,
  fileType: 'pdf' | 'excel' | 'word' | 'image'
): string {
  const profile = getSupplierProfile(supplierId);
  const typeHint = profile.extractionHints[fileType] ?? '';
  const parts = [profile.defaultHint, typeHint].filter(Boolean);
  return parts.join('\n\n');
}
