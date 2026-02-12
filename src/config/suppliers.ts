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
    defaultDiscount: 45,
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
Mark intersection rows as accessories (isAccessory=true) and include ALL column headers they belong to in fitsProducts.

ARTICLE NUMBERS — Line-break artifacts:
- Column header article numbers sometimes wrap across two lines in the PDF (e.g., "S680/LA" on one line and "PTOP" on the next).
- ALWAYS join such fragments WITHOUT a space: "S680/LAPTOP", NOT "S680/LA PTOP".
- Article numbers NEVER contain spaces. Remove any spaces that appear within them.

ACCESSORY ARTICLE NUMBERS:
- For accessories in the matrix, the article number is printed in the LOWER part of the same table cell as the accessory price.
- Look carefully inside each price cell for a small article number below or next to the price value. That is the accessory's artikelnr.

"Standard" CELLS — SKIP THEM:
- If a matrix cell contains ONLY the word "Standard" (no price), it means that accessory is included by default with that main product. Do NOT extract it as a separate row. Skip that cell entirely.

LOCK TYPE (LÅSNING) IN LEFTMOST COLUMN:
- Some tables have a "Låsning" or lock type column as the LEFTMOST column (e.g., "Nyckellås", "Kodlås", "Elkodlås", "Nyckellås med vred", "Elektroniskt kodlås").
- When the lock type appears at the far LEFT of the table header and data rows, it describes a VARIANT of the main product. It is NOT the product name itself.
- In this case, APPEND the lock type at the END of benamning, separated by a comma.
- Example: main product is "Säkerhetsskåp SA210" and the leftmost column says "Nyckellås" → benamning: "Säkerhetsskåp SA210, Nyckellås"
- Example: main product is "Dokumentskåp DS200" and leftmost column says "Elkodlås" → benamning: "Dokumentskåp DS200, Elkodlås"
- Do NOT put the lock type first: "Nyckellås Säkerhetsskåp SA210" is WRONG.
- Each lock type variant with its own price is a SEPARATE product row — extract every variant.

FIND ALL ARTICLES — Be thorough:
- Extract products from EVERY table on EVERY page. Do not skip any section.
- Some pages have multiple separate tables or product groups — extract from ALL of them.
- Products may appear in both matrix format AND list format on the same page.
- If a row has an article number AND a price, it is a product — extract it even if it looks like a sub-header.
- Pay attention to smaller tables, side sections, and footnote tables listing additional variants, sizes, or options.
- Each unique combination of article number + lock type + size is a separate product.

IMPORTANT — Validate each "benamning" before finalizing:
- For main products: the benamning should be a real product name (e.g., "Säkerhetsskåp SA210", "Dokumentskåp DS200"), NOT a column header, category title, or page label.
- For accessories: the benamning should describe the accessory itself (e.g., "Elkodlås 1+1 kod", "Hyllplan extra"), NOT the main product it fits. The main product goes in fitsProducts.
- In matrix layouts, the accessory name comes from the ROW label on the LEFT side, never from the COLUMN header. Column headers identify the main products (fitsProducts).
- If a benamning looks like just a model code (e.g., "SA210") without a descriptive name, look at surrounding context — headings, row labels, or the category — to build a more descriptive name like "Säkerhetsskåp SA210".
- If a benamning seems to be a category heading rather than a product name, re-examine: the actual product name is likely on the same row but in a different position.
- When uncertain, prefer combining the category/varugrupp with the article number (e.g., "Nyckelskåp NE400") over leaving a vague or incorrect name.`,
      excel: `Profsafe Excel files often have one sheet per product category.
The sheet name IS the product category (varugrupp).
Main products are listed with article numbers, names, dimensions, weights, and prices.
Look for offset accessory tables in side columns (E-H or further right).
These offset tables list accessories that belong to the main products on the same sheet.`,
    },
  },
  {
    id: 'grimstorp',
    name: 'Grimstorp',
    defaultDiscount: 35,
    defaultHint: 'This is a Grimstorp price list.',
    extractionHints: {},
  },
  {
    id: 'businesstonordic',
    name: 'Business To Nordic',
    defaultDiscount: 0,
    defaultHint: 'This is a Business To Nordic price list.',
    extractionHints: {},
  },
  {
    id: 'creone',
    name: 'Creone',
    defaultDiscount: 0,
    defaultHint: 'This is a Creone price list.',
    extractionHints: {},
  },
  {
    id: 'altikon',
    name: 'Altikon',
    defaultDiscount: 0,
    defaultHint: 'This is an Altikon price list.',
    extractionHints: {},
  },
  {
    id: 'jiwa',
    name: 'JiWa',
    defaultDiscount: 33,
    defaultHint: 'This is a JiWa price list.',
    extractionHints: {},
  },
  {
    id: 'formcase',
    name: 'Formcase',
    defaultDiscount: 0,
    defaultHint: 'This is a Formcase price list.',
    extractionHints: {},
  },
  {
    id: 'generic',
    name: 'Övrig leverantör',
    defaultDiscount: 0,
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
