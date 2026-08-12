import { describe, it, expect } from 'vitest';
import { createLimiter } from '../limiter.js';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createLimiter', () => {
  it('never runs more tasks concurrently than the given limit', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let maxActive = 0;
    const gates = Array.from({ length: 6 }, () => deferred<void>());

    const runs = gates.map((gate, i) =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active--;
        return i;
      }),
    );

    // Let the microtask queue settle so the first batch actually starts.
    await Promise.resolve();
    await Promise.resolve();
    expect(maxActive).toBe(2);

    gates.forEach((gate) => gate.resolve());
    const results = await Promise.all(runs);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxActive).toBe(2);
  });

  it('starts queued work as running slots free up', async () => {
    const limit = createLimiter(1);
    const order: number[] = [];
    const gate = deferred<void>();

    const first = limit(async () => {
      await gate.promise;
      order.push(1);
    });
    const second = limit(async () => {
      order.push(2);
    });

    await Promise.resolve();
    expect(order).toEqual([]); // second hasn't started yet, first still holds the slot

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });

  it('resolves each call with its own task result', async () => {
    const limit = createLimiter(3);
    const results = await Promise.all([
      limit(async () => 'a'),
      limit(async () => 'b'),
      limit(async () => 'c'),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('propagates a rejected task to its own caller without affecting others', async () => {
    const limit = createLimiter(2);
    const failure = new Error('boom');

    const results = await Promise.allSettled([
      limit(async () => {
        throw failure;
      }),
      limit(async () => 'ok'),
    ]);

    expect(results[0]).toEqual({ status: 'rejected', reason: failure });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'ok' });
  });

  it('keeps processing the queue after an earlier task rejects', async () => {
    const limit = createLimiter(1);

    const first = limit(async () => {
      throw new Error('boom');
    });
    const second = limit(async () => 'still runs');

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('still runs');
  });
});
