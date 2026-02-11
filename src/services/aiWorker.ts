/**
 * Web Worker that makes Gemini API calls via raw fetch.
 *
 * Web Workers run in a separate thread that Chrome NEVER throttles or freezes,
 * even when the tab is in the background. This guarantees that long-running
 * conversions complete regardless of tab focus.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

interface ExtractImageMsg {
  type: 'extract-image';
  id: number;
  imageBase64: string;
  mimeType: string;
  prompt: string;
  apiKey: string;
}

interface ExtractTextMsg {
  type: 'extract-text';
  id: number;
  textContent: string;
  prompt: string;
  apiKey: string;
}

type WorkerMessage = ExtractImageMsg | ExtractTextMsg;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  try {
    let text: string;
    if (msg.type === 'extract-image') {
      text = await callGemini(msg.apiKey, [
        { text: msg.prompt },
        { inlineData: { mimeType: msg.mimeType, data: msg.imageBase64 } },
      ]);
    } else {
      text = await callGemini(msg.apiKey, [
        { text: `${msg.prompt}\n\nHere is the document content:\n\n${msg.textContent}` },
      ]);
    }
    const rows = parseResponse(text);
    self.postMessage({ type: 'result', id: msg.id, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', id: msg.id, message });
  }
};

async function callGemini(apiKey: string, parts: unknown[]): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      });

      if (response.status === 429) {
        throw new Error('429 Resource exhausted');
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API ${response.status}: ${body.substring(0, 200)}`);
      }

      const json = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 = lastError.message.includes('429') || lastError.message.includes('Resource exhausted');
      if (!is429 || attempt === MAX_RETRIES) throw lastError;
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function parseResponse(text: string): unknown[] {
  let cleaned = text;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
