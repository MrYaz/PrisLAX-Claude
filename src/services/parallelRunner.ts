/**
 * Parallel task runner with configurable concurrency.
 *
 * Runs up to `concurrency` tasks at the same time using a worker pool pattern.
 * Respects AbortSignal and fails fast if no task has succeeded yet.
 */

export interface ParallelTask<T> {
  label: string;
  run: () => Promise<T>;
}

export interface ParallelResult {
  succeeded: number;
  failed: number;
  firstError: Error | null;
}

export async function runParallel<T>(
  tasks: ParallelTask<T>[],
  options: {
    concurrency: number;
    signal: AbortSignal;
    onTaskDone: (result: T, index: number, label: string) => void;
    onTaskError: (error: Error, index: number, label: string) => void;
  },
): Promise<ParallelResult> {
  const { concurrency, signal, onTaskDone, onTaskError } = options;

  let nextIndex = 0;
  let succeeded = 0;
  let failed = 0;
  let firstError: Error | null = null;
  let shouldStop = false;

  async function worker(): Promise<void> {
    while (!shouldStop && !signal.aborted) {
      const index = nextIndex++;
      if (index >= tasks.length) return;

      const task = tasks[index];
      try {
        const result = await task.run();
        if (signal.aborted) return;
        succeeded++;
        onTaskDone(result, index, task.label);
      } catch (err) {
        failed++;
        const error = err instanceof Error ? err : new Error(String(err));
        if (!firstError) firstError = error;
        onTaskError(error, index, task.label);

        // If nothing has succeeded yet, stop starting new tasks.
        // Already in-flight tasks will finish naturally.
        if (succeeded === 0) {
          shouldStop = true;
          return;
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  // Stagger worker starts by 500ms each to avoid burst API calls
  const STAGGER_MS = 500;
  await Promise.all(
    Array.from({ length: workerCount }, (_, i) =>
      new Promise<void>((resolve) => setTimeout(resolve, i * STAGGER_MS)).then(() => worker())
    )
  );

  return { succeeded, failed, firstError };
}
