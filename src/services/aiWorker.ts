/**
 * Web Worker that makes Gemini API calls via raw fetch.
 *
 * Web Workers run in a separate thread that Chrome NEVER throttles or freezes,
 * even when the tab is in the background. This guarantees that long-running
 * conversions complete regardless of tab focus.
 *
 * Supports both single requests and batch processing with internal concurrency.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;
const STAGGER_MS = 500;

// ─── Single request types (kept for backwards compat / validateApiKey) ───

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

// ─── Batch processing types ───

interface BatchTaskItem {
  taskId: number;
  kind: 'image' | 'text';
  imageBase64?: string;
  mimeType?: string;
  textContent?: string;
  prompt: string;
  label: string;
}

interface ProcessBatchMsg {
  type: 'process-batch';
  id: number;
  tasks: BatchTaskItem[];
  concurrency: number;
  apiKey: string;
}

type WorkerMessage = ExtractImageMsg | ExtractTextMsg | ProcessBatchMsg;

// ─── Message handler ───

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'process-batch') {
    await handleBatch(msg);
    return;
  }

  // Single request (legacy)
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

// ─── Batch processing ───

async function handleBatch(msg: ProcessBatchMsg): Promise<void> {
  const { id, tasks, concurrency, apiKey } = msg;

  let nextIndex = 0;
  let succeeded = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIndex++;
      if (idx >= tasks.length) return;

      const task = tasks[idx];
      try {
        let text: string;
        if (task.kind === 'image') {
          text = await callGemini(apiKey, [
            { text: task.prompt },
            { inlineData: { mimeType: task.mimeType ?? 'image/png', data: task.imageBase64 ?? '' } },
          ]);
        } else {
          text = await callGemini(apiKey, [
            { text: `${task.prompt}\n\nHere is the document content:\n\n${task.textContent ?? ''}` },
          ]);
        }
        const rows = parseResponse(text);
        succeeded++;
        self.postMessage({
          type: 'batch-task-done',
          id,
          taskId: task.taskId,
          rows,
          label: task.label,
        });
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({
          type: 'batch-task-error',
          id,
          taskId: task.taskId,
          message,
          label: task.label,
        });

        // If nothing has succeeded yet and we've had failures, stop early
        if (succeeded === 0 && failed >= concurrency) return;
      }
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  // Stagger worker starts to avoid burst API calls
  await Promise.all(
    Array.from({ length: workerCount }, (_, i) =>
      new Promise<void>((resolve) => setTimeout(resolve, i * STAGGER_MS)).then(() => worker())
    )
  );

  self.postMessage({
    type: 'batch-done',
    id,
    succeeded,
    failed,
  });
}

// ─── Gemini API call with retry ───

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

// ─── Response parsing ───

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
