import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../utils/concurrency.js';

describe('runWithConcurrency', () => {
  it('limits the number of active tasks', async () => {
    let activeTasks = 0;
    let maximumActiveTasks = 0;

    const results = await runWithConcurrency(
      Array.from({ length: 5 }, (_, index) => async () => {
        activeTasks += 1;
        maximumActiveTasks = Math.max(maximumActiveTasks, activeTasks);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeTasks -= 1;
        return index;
      }),
      2,
    );

    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(maximumActiveTasks).toBe(2);
  });

  it('returns immediately when there are no tasks', async () => {
    await expect(runWithConcurrency([], 2)).resolves.toEqual([]);
  });

  it('stops scheduling tasks after a failure', async () => {
    const startedTasks: number[] = [];

    await expect(
      runWithConcurrency(
        Array.from({ length: 5 }, (_, index) => async () => {
          startedTasks.push(index);

          if (index === 0) {
            throw new Error('failed');
          }

          await new Promise((resolve) => setTimeout(resolve, 10));
        }),
        2,
      ),
    ).rejects.toThrow('failed');

    expect(startedTasks).toEqual([0, 1]);
  });

  it('waits for active tasks to settle after cancellation', async () => {
    const controller = new AbortController();
    let activeTasks = 0;
    let maximumActiveTasks = 0;

    const promise = runWithConcurrency(
      Array.from({ length: 3 }, (_, index) => async () => {
        activeTasks += 1;
        maximumActiveTasks = Math.max(maximumActiveTasks, activeTasks);

        try {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return index;
        } finally {
          activeTasks -= 1;
        }
      }),
      2,
      { signal: controller.signal },
    );

    controller.abort(new Error('cancelled'));

    await expect(promise).rejects.toThrow('cancelled');
    expect(activeTasks).toBe(0);
    expect(maximumActiveTasks).toBe(2);
  });
});
