import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import type { RawExtractedRow } from '../types';

let genAI: GoogleGenerativeAI | null = null;

function getApiKey(): string {
  // VITE_ env vars are embedded at build time
  const key = import.meta.env.VITE_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'API-nyckel saknas. Sätt VITE_API_KEY som miljövariabel.'
    );
  }
  return key;
}

/** Check that an API key is configured. Throws with a user-friendly message if not. */
export function validateApiKey(): void {
  getApiKey();
}

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(getApiKey());
  }
  return genAI;
}

const EXTRACTION_PROMPT = `You are a data extraction assistant. Your ONLY job is to look at this document content and extract every product/article row you can find.

For EACH product or article row, extract these fields:
- artikelnr: the article number / product code / SKU
- benamning: the product name / description
- varugrupp: the product group or category (from sheet name, heading, or context)
- vikt: weight (if present)
- volym: volume (if present)
- pallkostnad: pallet cost (if present)
- pris: the price (the most specific price you can find, e.g. net price, unit price)
- isAccessory: true if this row is clearly an accessory/tillbehör for another product
- fitsProducts: if this is an accessory, list the main product names or article numbers it belongs to

IMPORTANT RULES:
- Extract EVERY product row you find. Do not skip any.
- For matrix/grid layouts where columns are main products and rows are accessories with prices at intersections, extract each intersection as a separate row. Mark these as accessories.
- If a page has no product data at all (just text, terms, conditions, logos), return an empty array.
- Do NOT invent data. Only extract what is actually visible.
- Prices should be numbers only (no currency symbols). Use dot as decimal separator.
- If volume is given in liters, convert to cubic meters (divide by 1000).

Return ONLY a JSON array. No markdown, no explanation. Example:
[{"artikelnr":"SA210","benamning":"Säkerhetsskåp SA210","varugrupp":"Säkerhetsskåp","vikt":"45 kg","volym":"0.35","pallkostnad":"","pris":"4500","isAccessory":false,"fitsProducts":[]},{"artikelnr":"EL-100","benamning":"Elkodlås 1+1 kod","varugrupp":"","vikt":"","volym":"","pallkostnad":"","pris":"890","isAccessory":true,"fitsProducts":["SA210","SA390"]}]

If no products found, return: []`;

/**
 * Extract product rows from an image (rendered PDF page, photo, etc.)
 */
export async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  contextHint?: string
): Promise<RawExtractedRow[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = contextHint
    ? `${EXTRACTION_PROMPT}\n\nAdditional context: ${contextHint}`
    : EXTRACTION_PROMPT;

  const imagePart: Part = {
    inlineData: {
      mimeType,
      data: imageBase64,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();
  return parseAIResponse(text);
}

/**
 * Extract product rows from text content (Excel sheet data, Word text, etc.)
 */
export async function extractFromText(
  textContent: string,
  contextHint?: string
): Promise<RawExtractedRow[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = contextHint
    ? `${EXTRACTION_PROMPT}\n\nAdditional context: ${contextHint}`
    : EXTRACTION_PROMPT;

  const fullPrompt = `${prompt}\n\nHere is the document content:\n\n${textContent}`;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text().trim();
  return parseAIResponse(text);
}

function parseAIResponse(text: string): RawExtractedRow[] {
  // Strip markdown code fences if present
  let cleaned = text;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((row: Record<string, unknown>) => ({
      artikelnr: String(row.artikelnr ?? '').trim(),
      benamning: String(row.benamning ?? '').trim(),
      varugrupp: String(row.varugrupp ?? '').trim(),
      vikt: String(row.vikt ?? '').trim(),
      volym: String(row.volym ?? '').trim(),
      pallkostnad: String(row.pallkostnad ?? '').trim(),
      pris: String(row.pris ?? '').trim(),
      isAccessory: Boolean(row.isAccessory),
      fitsProducts: Array.isArray(row.fitsProducts)
        ? row.fitsProducts.map((p: unknown) => String(p).trim())
        : [],
    }));
  } catch {
    console.error('Failed to parse AI response:', cleaned.substring(0, 500));
    return [];
  }
}
