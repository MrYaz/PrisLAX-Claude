/** A single product row in the standardized output format */
export interface PriceRow {
  /** Supplier's article number */
  ertArtikelnr: string;
  /** Our internal article number (filled by mapping, never by AI) */
  vartArtikelnr: string;
  /** Product name / description */
  benamning: string;
  /** Product group / category */
  varugrupp: string;
  /** Short description */
  kortBeskrivning: string;
  /** Original / list price before discounts */
  ordPris: string;
  /** Discount percentage applied */
  rabattProcent: string;
  /** Net price in SEK */
  nettoprisSEK: string;
  /** Weight in kg */
  vikt: string;
  /** Volume in cubic meters */
  volym: string;
  /** Height in mm */
  hojd: string;
  /** Width in mm */
  bredd: string;
  /** Depth in mm */
  djup: string;
  /** Diameter in mm */
  diameter: string;
  /** Full pallet quantity */
  helpall: string;
  /** Half pallet quantity */
  halvpall: string;
  /** Pallet cost */
  pallkostnad: string;
  /** RAL color code */
  ralFarg: string;
  /** Fixed freight cost */
  fastFrakt: string;
  /** Delivery time in days */
  leveranstid: string;
  /** Country of origin */
  ursprungsland: string;
  /** Link to product manual */
  manualLank: string;
  /** Link to product page */
  produktLank: string;
}

/** Raw extracted row from AI – before post-processing */
export interface RawExtractedRow {
  artikelnr: string;
  benamning: string;
  varugrupp: string;
  kortBeskrivning: string;
  vikt: string;
  volym: string;
  hojd: string;
  bredd: string;
  djup: string;
  diameter: string;
  helpall: string;
  halvpall: string;
  pallkostnad: string;
  ralFarg: string;
  fastFrakt: string;
  leveranstid: string;
  ursprungsland: string;
  manualLank: string;
  produktLank: string;
  pris: string;
  /** If AI detects this is an accessory */
  isAccessory: boolean;
  /** Which main products this accessory fits (if applicable) */
  fitsProducts: string[];
}

/** Article mapping entry */
export interface ArticleMapping {
  supplier: string;
  supplierArtikelnr: string;
  internArtikelnr: string;
  productName: string;
}

/** Detailed extraction statistics for the status monitor */
export interface ExtractionStats {
  articlesFound: number;
  accessoriesFound: number;
  varugrupper: string[];
  pageDetails: { label: string; articles: number; accessories: number }[];
}

/** Progress callback info */
export interface ProgressInfo {
  message: string;
  current: number;
  total: number;
  stats?: ExtractionStats;
}

/** Pricing settings from user */
export interface PricingSettings {
  /** Dealer discount percentage (0-100) */
  dealerDiscount: number;
  /** Price adjustment percentage (can be negative) */
  priceAdjustment: number;
  /** Currency exchange rate to SEK (1 if already SEK) */
  exchangeRate: number;
}

/** Supported file types */
export type SupportedFileType = 'pdf' | 'excel' | 'word' | 'image';

/** Supplier-specific extraction profile */
export interface SupplierProfile {
  id: string;
  name: string;
  /** Supplier-specific hints per file type that get appended to the AI prompt */
  extractionHints: Partial<Record<SupportedFileType, string>>;
  /** Default hint used when no file-type-specific hint exists */
  defaultHint: string;
  /** Default dealer discount percentage for this supplier (0-100) */
  defaultDiscount: number;
}

export const OUTPUT_COLUMNS = [
  'Ert artikelnr',
  'Vårt artikelnr',
  'Benämning',
  'Varugrupp',
  'Kort beskrivning',
  'Ord. pris',
  'Rabatt %',
  'Nettopris (SEK)',
  'Vikt (kg)',
  'Volym (m3)',
  'Höjd (mm)',
  'Bredd (mm)',
  'Djup (mm)',
  'Diameter (mm)',
  'Helpall',
  'Halvpall',
  'Pallkostnad',
  'RAL-färg',
  'Fast frakt (kr)',
  'Leveranstid (dagar)',
  'Ursprungsland',
  'Manual-länk',
  'Produktlänk',
] as const;
