export type RunWithConcurrencyOptions = {
  signal?: AbortSignal;
};

export const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  { signal }: RunWithConcurrencyOptions = {},
): Promise<T[]> => {
  if (tasks.length === 0) {
    return [];
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  const results = new Array<T>(tasks.length);
  let nextTaskIndex = 0;
  let firstError: unknown;

  const worker = async () => {
    while (!signal?.aborted && firstError === undefined) {
      const taskIndex = nextTaskIndex++;

      if (taskIndex >= tasks.length) {
        return;
      }

      try {
        results[taskIndex] = await tasks[taskIndex]();
      } catch (error) {
        firstError ??= error;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));

  if (firstError !== undefined) {
    throw firstError;
  }

  if (signal?.aborted) {
    const reason = (signal as AbortSignal & { reason?: unknown }).reason;
    throw reason ?? new Error('Operation was aborted');
  }

  return results;
};
