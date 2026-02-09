import mammoth from 'mammoth';
import type { RawExtractedRow, ProgressInfo } from '../types';
import { extractFromText } from './ai';

const MAX_CHARS_PER_CHUNK = 8000;

/**
 * Process a Word (.docx) file: extract text, send to AI for extraction.
 */
export async function processWord(
  file: File,
  onProgress: (info: ProgressInfo) => void
): Promise<RawExtractedRow[]> {
  onProgress({
    message: 'Läser Word-dokument...',
    current: 0,
    total: 1,
  });

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  if (!text.trim()) {
    onProgress({ message: 'Word-dokumentet var tomt', current: 1, total: 1 });
    return [];
  }

  // Chunk by paragraphs if large
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    onProgress({ message: 'Analyserar Word-dokument...', current: 0, total: 1 });
    const contextHint = `This text comes from a Word document named "${file.name}". Extract all product/price data you can find.`;
    const rows = await extractFromText(text, contextHint);
    onProgress({ message: 'Word-dokument klart', current: 1, total: 1 });
    return rows;
  }

  // Split into chunks
  const paragraphs = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > MAX_CHARS_PER_CHUNK && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += para + '\n';
  }
  if (currentChunk.trim()) chunks.push(currentChunk);

  const allRows: RawExtractedRow[] = [];
  const totalChunks = chunks.length;
  let hasSucceeded = false;

  for (let i = 0; i < totalChunks; i++) {
    onProgress({
      message: `Behandlar del ${i + 1} av ${totalChunks} från Word-dokument`,
      current: i,
      total: totalChunks,
    });

    const contextHint = `This text comes from a Word document named "${file.name}", part ${i + 1} of ${totalChunks}.`;
    try {
      const rows = await extractFromText(chunks[i], contextHint);
      allRows.push(...rows);
      hasSucceeded = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!hasSucceeded) {
        throw new Error(`AI-anrop misslyckades (Word del ${i + 1}): ${msg}`);
      }
      console.warn(`Word del ${i + 1} misslyckades, fortsätter: ${msg}`);
    }
  }

  onProgress({ message: 'Word-dokument klart', current: totalChunks, total: totalChunks });
  return allRows;
}
