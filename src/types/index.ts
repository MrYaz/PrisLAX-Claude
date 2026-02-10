/** A single product row in the standardized output format */
export interface PriceRow {
  /** Supplier's article number */
  ertArtikelnr: string;
  /** Our internal article number (filled by mapping, never by AI) */
  vartArtikelnr: string;
  /** Product group / category */
  varugrupp: string;
  /** Product name / description */
  benamning: string;
  /** Weight */
  vikt: string;
  /** Volume in cubic meters */
  volym: string;
  /** Pallet cost */
  pallkostnad: string;
  /** Original price (empty if same as nettopris) */
  originalpris: string;
  /** Net price in SEK */
  nettoprisSEK: string;
}

/** Raw extracted row from AI – before post-processing */
export interface RawExtractedRow {
  artikelnr: string;
  benamning: string;
  varugrupp: string;
  vikt: string;
  volym: string;
  pallkostnad: string;
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
}

export const OUTPUT_COLUMNS = [
  'Ert Artikelnr',
  'Vårt Artikelnr',
  'Varugrupp',
  'Benämning',
  'Vikt',
  'Volym (m³)',
  'Pallkostnad',
  'Originalpris',
  'Nettopris (SEK)',
] as const;
