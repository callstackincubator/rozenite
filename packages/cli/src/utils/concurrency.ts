export const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> => {
  if (tasks.length === 0) {
    return [];
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  const results = new Array<T>(tasks.length);
  let nextTaskIndex = 0;

  const worker = async () => {
    while (true) {
      const taskIndex = nextTaskIndex++;

      if (taskIndex >= tasks.length) {
        return;
      }

      results[taskIndex] = await tasks[taskIndex]();
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
};
