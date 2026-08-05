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
});
