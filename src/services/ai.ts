import type { RawExtractedRow } from '../types';

/**
 * AI extraction service.
 *
 * All Gemini API calls are made from a Web Worker so they continue running
 * even when the browser tab is in the background (Chrome freezes main-thread
 * JS in background tabs but never throttles Web Workers).
 */

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, {
  resolve: (rows: RawExtractedRow[]) => void;
  reject: (err: Error) => void;
}>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./aiWorker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const { id, type, rows, message } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (type === 'result') {
        p.resolve(normalizeRows(rows ?? []));
      } else {
        p.reject(new Error(message ?? 'Worker error'));
      }
    };
    worker.onerror = (e) => {
      // Reject all pending requests
      const err = new Error(e.message || 'Worker crashed');
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
  }
  return worker;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'API-nyckel saknas. Sätt VITE_API_KEY som miljövariabel.'
    );
  }
  return key;
}

export function validateApiKey(): void {
  getApiKey();
}

const EXTRACTION_PROMPT = `You are a data extraction assistant. Your ONLY job is to look at this document content and extract every product/article row you can find.

For EACH product or article row, extract these fields:
- artikelnr: the article number / product code / SKU. IMPORTANT: Article numbers NEVER contain spaces. If you see what looks like a line break in an article number (e.g., "S680/LA PTOP" or "S1000/L APTOP"), remove the space to form one continuous string (e.g., "S680/LAPTOP", "S1000/LAPTOP").
- benamning: the product name / description
- varugrupp: the product group or category (from sheet name, heading, or context)
- kortBeskrivning: a short description if available (distinct from benamning)
- vikt: weight in kg (if present)
- volym: volume in m³ (if present)
- hojd: height in mm (if present)
- bredd: width in mm (if present)
- djup: depth in mm (if present)
- diameter: diameter in mm (if present)
- helpall: full pallet quantity (if present)
- halvpall: half pallet quantity (if present)
- pallkostnad: pallet cost (if present)
- ralFarg: RAL color code (if present)
- fastFrakt: fixed freight cost (if present)
- leveranstid: delivery time in days (if present)
- ursprungsland: country of origin (if present)
- manualLank: URL to product manual (if present)
- produktLank: URL to product page (if present)
- pris: the price (the most specific price you can find, e.g. net price, unit price)
- isAccessory: true if this row is clearly an accessory/tillbehör for another product
- fitsProducts: if this is an accessory, list the main product names or article numbers it belongs to

IMPORTANT RULES:
- Extract EVERY product row you find. Do not skip any.
- For matrix/grid layouts where columns are main products and rows are accessories with prices at intersections, extract each intersection as a separate row. Mark these as accessories.
- If a page has no product data at all (just text, terms, conditions, logos), return an empty array.
- Do NOT invent data. Only extract what is actually visible.
- Article numbers must NOT contain spaces — always join fragments into one continuous string.
- Prices should be numbers only (no currency symbols). Use dot as decimal separator.
- Dimensions (height, width, depth, diameter) should be numbers in mm without units.
- Weight should be a number in kg without units.
- If volume is given in liters, convert to cubic meters (divide by 1000).

Return ONLY a JSON array. No markdown, no explanation. Example:
[{"artikelnr":"SA210","benamning":"Säkerhetsskåp SA210","varugrupp":"Säkerhetsskåp","kortBeskrivning":"","vikt":"45","volym":"0.35","hojd":"1200","bredd":"600","djup":"500","diameter":"","helpall":"","halvpall":"","pallkostnad":"","ralFarg":"","fastFrakt":"","leveranstid":"","ursprungsland":"","manualLank":"","produktLank":"","pris":"4500","isAccessory":false,"fitsProducts":[]},{"artikelnr":"EL-100","benamning":"Elkodlås 1+1 kod","varugrupp":"","kortBeskrivning":"","vikt":"","volym":"","hojd":"","bredd":"","djup":"","diameter":"","helpall":"","halvpall":"","pallkostnad":"","ralFarg":"","fastFrakt":"","leveranstid":"","ursprungsland":"","manualLank":"","produktLank":"","pris":"890","isAccessory":true,"fitsProducts":["SA210","SA390"]}]

If no products found, return: []`;

/**
 * Build the full prompt by combining the base extraction prompt,
 * supplier-specific hint, and page/sheet context hint.
 */
function buildPrompt(supplierHint: string, contextHint: string): string {
  const parts = [EXTRACTION_PROMPT];
  if (supplierHint) {
    parts.push(`\nSUPPLIER-SPECIFIC GUIDANCE:\n${supplierHint}`);
  }
  if (contextHint) {
    parts.push(`\nAdditional context: ${contextHint}`);
  }
  return parts.join('\n');
}

/**
 * Send an extraction request to the Web Worker and wait for the result.
 */
function sendToWorker(msg: Record<string, unknown>): Promise<RawExtractedRow[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...msg, id, apiKey: getApiKey() });
  });
}

/**
 * Extract product rows from an image (rendered PDF page, photo, etc.)
 */
export async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  supplierHint: string,
  contextHint: string
): Promise<RawExtractedRow[]> {
  const prompt = buildPrompt(supplierHint, contextHint);
  return sendToWorker({
    type: 'extract-image',
    imageBase64,
    mimeType,
    prompt,
  });
}

/**
 * Extract product rows from text content (Excel sheet data, Word text, etc.)
 */
export async function extractFromText(
  textContent: string,
  supplierHint: string,
  contextHint: string
): Promise<RawExtractedRow[]> {
  const prompt = buildPrompt(supplierHint, contextHint);
  return sendToWorker({
    type: 'extract-text',
    textContent,
    prompt,
  });
}

/**
 * Normalize raw JSON rows from the worker into typed RawExtractedRow[].
 */
function normalizeRows(raw: unknown[]): RawExtractedRow[] {
  return raw.map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      artikelnr: String(row.artikelnr ?? '').replace(/\s+/g, '').trim(),
      benamning: String(row.benamning ?? '').trim(),
      varugrupp: String(row.varugrupp ?? '').trim(),
      kortBeskrivning: String(row.kortBeskrivning ?? '').trim(),
      vikt: String(row.vikt ?? '').trim(),
      volym: String(row.volym ?? '').trim(),
      hojd: String(row.hojd ?? '').trim(),
      bredd: String(row.bredd ?? '').trim(),
      djup: String(row.djup ?? '').trim(),
      diameter: String(row.diameter ?? '').trim(),
      helpall: String(row.helpall ?? '').trim(),
      halvpall: String(row.halvpall ?? '').trim(),
      pallkostnad: String(row.pallkostnad ?? '').trim(),
      ralFarg: String(row.ralFarg ?? '').trim(),
      fastFrakt: String(row.fastFrakt ?? '').trim(),
      leveranstid: String(row.leveranstid ?? '').trim(),
      ursprungsland: String(row.ursprungsland ?? '').trim(),
      manualLank: String(row.manualLank ?? '').trim(),
      produktLank: String(row.produktLank ?? '').trim(),
      pris: String(row.pris ?? '').trim(),
      isAccessory: Boolean(row.isAccessory),
      fitsProducts: Array.isArray(row.fitsProducts)
        ? row.fitsProducts.map((p: unknown) => String(p).trim())
        : [],
    };
  });
}
