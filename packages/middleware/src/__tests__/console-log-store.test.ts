import { describe, expect, it } from 'vitest';
import { createConsoleLogStore } from '../agent/runtime/console/store.js';
import type { ConsoleLogLevel } from '../agent/runtime/console/types.js';

const DEVICE = 'device-1';

const appendMessages = (
  store: ReturnType<typeof createConsoleLogStore>,
  count: number,
  level: ConsoleLogLevel = 'info',
): void => {
  for (let i = 0; i < count; i += 1) {
    store.append(DEVICE, { level, text: `message-${i}`, source: 'console', timestamp: 1_000 + i });
  }
};

const texts = (result: { items: Array<{ text: string }> }): string[] =>
  result.items.map((item) => item.text);

describe('console log store', () => {
  it('assigns seq starting at 1 and reports buffer meta', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 3);

    const result = store.getMessages(DEVICE, { order: 'asc' });

    expect(result.items.map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(result.meta).toEqual({ droppedCount: 0, lastSeq: 3, bufferSize: 3 });
  });

  it('evicts the oldest entries once capacity is exceeded', () => {
    const store = createConsoleLogStore(3);
    appendMessages(store, 5);

    const result = store.getMessages(DEVICE, { order: 'asc' });

    expect(texts(result)).toEqual(['message-2', 'message-3', 'message-4']);
    expect(result.items.map((item) => item.seq)).toEqual([3, 4, 5]);
    expect(result.meta).toEqual({ droppedCount: 2, lastSeq: 5, bufferSize: 3 });
  });

  it('defaults to newest-first order', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 3);

    expect(texts(store.getMessages(DEVICE, {}))).toEqual(['message-2', 'message-1', 'message-0']);
  });

  it('pages through every entry without repeats or gaps', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 5);

    const seen: string[] = [];
    let cursor: string | undefined;
    let guard = 0;

    do {
      const page = store.getMessages(DEVICE, { limit: 2, order: 'asc', cursor });
      seen.push(...texts(page));
      cursor = page.page.nextCursor;
      guard += 1;
    } while (cursor && guard < 10);

    expect(seen).toEqual(['message-0', 'message-1', 'message-2', 'message-3', 'message-4']);
  });

  it('pages descending without repeats or gaps', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 5);

    const seen: string[] = [];
    let cursor: string | undefined;
    let guard = 0;

    do {
      const page = store.getMessages(DEVICE, { limit: 2, cursor });
      seen.push(...texts(page));
      cursor = page.page.nextCursor;
      guard += 1;
    } while (cursor && guard < 10);

    expect(seen).toEqual(['message-4', 'message-3', 'message-2', 'message-1', 'message-0']);
  });

  it('filters by level, text and timestamp', () => {
    const store = createConsoleLogStore(10);
    // Already-in-milliseconds timestamps, so ingest leaves them untouched.
    const base = 1_700_000_000_000;
    store.append(DEVICE, { level: 'info', text: 'boot ok', source: 'console', timestamp: base });
    store.append(DEVICE, { level: 'error', text: 'boom', source: 'console', timestamp: base + 1 });
    store.append(DEVICE, {
      level: 'error',
      text: 'later boom',
      source: 'console',
      timestamp: base + 2,
    });

    expect(texts(store.getMessages(DEVICE, { levels: ['error'], order: 'asc' }))).toEqual([
      'boom',
      'later boom',
    ]);
    expect(texts(store.getMessages(DEVICE, { text: 'BOOT', order: 'asc' }))).toEqual(['boot ok']);
    expect(texts(store.getMessages(DEVICE, { since: base + 2, order: 'asc' }))).toEqual([
      'later boom',
    ]);
  });

  it('keeps a filtered page consistent across cursors', () => {
    const store = createConsoleLogStore(10);
    for (let i = 0; i < 6; i += 1) {
      store.append(DEVICE, {
        level: i % 2 === 0 ? 'error' : 'info',
        text: `message-${i}`,
        source: 'console',
        timestamp: 1_000 + i,
      });
    }

    const first = store.getMessages(DEVICE, { levels: ['error'], order: 'asc', limit: 2 });
    expect(texts(first)).toEqual(['message-0', 'message-2']);
    expect(first.page.hasMore).toBe(true);

    const second = store.getMessages(DEVICE, {
      levels: ['error'],
      order: 'asc',
      limit: 2,
      cursor: first.page.nextCursor,
    });
    expect(texts(second)).toEqual(['message-4']);
    expect(second.page.hasMore).toBe(false);
  });

  it('restarts from the head when the cursor falls out of the buffer', () => {
    const store = createConsoleLogStore(3);
    appendMessages(store, 3);

    const first = store.getMessages(DEVICE, { limit: 1, order: 'asc' });
    expect(texts(first)).toEqual(['message-0']);

    // Push the cursor position out of the window.
    for (let i = 0; i < 5; i += 1) {
      store.append(DEVICE, { level: 'info', text: `later-${i}`, source: 'console', timestamp: 1 });
    }

    const resumed = store.getMessages(DEVICE, {
      limit: 1,
      order: 'asc',
      cursor: first.page.nextCursor,
    });

    // The cursor position is gone, so the page restarts from the oldest survivor.
    expect(resumed.page.reset).toBe(true);
    expect(texts(resumed)).toEqual(['later-2']);
  });

  it('keeps seq monotonic across clear', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 2);

    expect(store.clear(DEVICE)).toEqual({ cleared: 2 });

    const empty = store.getMessages(DEVICE, {});
    expect(empty.items).toEqual([]);
    expect(empty.meta).toEqual({ droppedCount: 0, lastSeq: 2, bufferSize: 0 });

    store.append(DEVICE, { level: 'info', text: 'after', source: 'console', timestamp: 9_000 });
    const after = store.getMessages(DEVICE, {});
    expect(after.items[0]?.seq).toBe(3);
    expect(after.meta?.lastSeq).toBe(3);
  });

  it('reads the entries leading up to an error found under a level filter', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 20);
    store.append(DEVICE, { level: 'error', text: 'boom', source: 'console', timestamp: 2_000 });
    appendMessages(store, 5);

    // The agent finds the error under a filter that no page cursor could survive.
    const errors = store.getMessages(DEVICE, { levels: ['error'] });
    expect(texts(errors)).toEqual(['boom']);
    const anchor = errors.items[0]?.cursor;
    expect(anchor).toBeTypeOf('string');

    // The same anchor is then valid against a completely unfiltered request.
    const leadUp = store.getMessages(DEVICE, { before: anchor, order: 'desc', limit: 10 });

    expect(texts(leadUp)).toEqual([
      'message-19',
      'message-18',
      'message-17',
      'message-16',
      'message-15',
      'message-14',
      'message-13',
      'message-12',
      'message-11',
      'message-10',
    ]);
  });

  it('reads the entries that followed an anchor', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 5);

    const anchor = store.getMessages(DEVICE, { order: 'asc' }).items[2]?.cursor;
    const after = store.getMessages(DEVICE, { after: anchor, order: 'asc' });

    expect(texts(after)).toEqual(['message-3', 'message-4']);
  });

  it('combines anchors with filters to bound a range', () => {
    const store = createConsoleLogStore(50);
    for (let i = 0; i < 10; i += 1) {
      store.append(DEVICE, {
        level: i % 2 === 0 ? 'error' : 'info',
        text: `message-${i}`,
        source: 'console',
        timestamp: 1_000 + i,
      });
    }

    const rows = store.getMessages(DEVICE, { order: 'asc' }).items;
    const after = rows[1]?.cursor;
    const before = rows[8]?.cursor;

    expect(
      texts(store.getMessages(DEVICE, { after, before, levels: ['error'], order: 'asc' })),
    ).toEqual(['message-2', 'message-4', 'message-6']);
  });

  it('pages within an anchored range', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 10);

    const anchor = store.getMessages(DEVICE, { order: 'asc' }).items[8]?.cursor;
    const first = store.getMessages(DEVICE, { before: anchor, order: 'desc', limit: 3 });
    expect(texts(first)).toEqual(['message-7', 'message-6', 'message-5']);

    const second = store.getMessages(DEVICE, {
      before: anchor,
      order: 'desc',
      limit: 3,
      cursor: first.page.nextCursor,
    });
    expect(texts(second)).toEqual(['message-4', 'message-3', 'message-2']);
  });

  it('rejects a malformed cursor', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 2);

    expect(() => store.getMessages(DEVICE, { before: 'not-a-cursor' })).toThrow(/Invalid "before"/);
    expect(() => store.getMessages(DEVICE, { after: '' })).not.toThrow();
    expect(() => store.getMessages(DEVICE, { cursor: 'not-a-cursor' })).toThrow(/Invalid "cursor"/);
  });

  it('resolves a cursor from another device in the target device position space', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 5);
    store.append('device-2', { level: 'info', text: 'other', source: 'console', timestamp: 1 });

    const foreign = store.getMessages(DEVICE, { order: 'asc' }).items[4]?.cursor;

    // Cursors no longer name their device, so this is accepted rather than
    // rejected. The position simply lands in device-2's own space: nothing
    // breaks, but the caller gets a slice they probably did not mean.
    const result = store.getMessages('device-2', { before: foreign, order: 'desc' });

    expect(texts(result)).toEqual(['other']);
    expect(result.page.reset).toBeUndefined();
  });

  it('uses one cursor for both roles', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 6);

    // An item's cursor resumes a listing exactly as a page cursor does.
    const page = store.getMessages(DEVICE, { order: 'asc', limit: 3 });
    expect(texts(page)).toEqual(['message-0', 'message-1', 'message-2']);

    const fromLastItem = store.getMessages(DEVICE, {
      order: 'asc',
      cursor: page.items[2]?.cursor,
    });
    const fromPageCursor = store.getMessages(DEVICE, {
      order: 'asc',
      cursor: page.page.nextCursor,
    });

    expect(texts(fromLastItem)).toEqual(['message-3', 'message-4', 'message-5']);
    expect(texts(fromPageCursor)).toEqual(texts(fromLastItem));
    // Same position, same filters, same order — so byte-identical.
    expect(page.items[2]?.cursor).toBe(page.page.nextCursor);
  });

  it('carries a cursor across filter sets and directions', () => {
    const store = createConsoleLogStore(50);
    for (let i = 0; i < 10; i += 1) {
      store.append(DEVICE, {
        level: i === 5 ? 'error' : 'info',
        text: `message-${i}`,
        source: 'console',
        timestamp: 1_000 + i,
      });
    }

    const anchor = store.getMessages(DEVICE, { levels: ['error'] }).items[0]?.cursor;

    // The position is absolute, so the same cursor reads either side under any
    // filter set. Binding the filters would have rejected all three of these.
    expect(texts(store.getMessages(DEVICE, { cursor: anchor, order: 'desc', limit: 2 }))).toEqual([
      'message-4',
      'message-3',
    ]);
    expect(texts(store.getMessages(DEVICE, { cursor: anchor, order: 'asc', limit: 2 }))).toEqual([
      'message-6',
      'message-7',
    ]);
    expect(
      texts(store.getMessages(DEVICE, { cursor: anchor, order: 'asc', text: 'message-9' })),
    ).toEqual(['message-9']);
  });

  it('bounds a range with a page cursor', () => {
    const store = createConsoleLogStore(50);
    appendMessages(store, 6);

    // A page cursor is a position like any other, so it works as a bound too.
    const page = store.getMessages(DEVICE, { order: 'asc', limit: 3 });

    expect(
      texts(store.getMessages(DEVICE, { before: page.page.nextCursor, order: 'desc' })),
    ).toEqual(['message-1', 'message-0']);
  });

  it('keeps devices isolated and drops state on unregister', () => {
    const store = createConsoleLogStore(10);
    appendMessages(store, 2);
    store.append('device-2', { level: 'info', text: 'other', source: 'console', timestamp: 1 });

    expect(texts(store.getMessages('device-2', {}))).toEqual(['other']);

    store.unregisterDevice(DEVICE);
    expect(store.getMessages(DEVICE, {}).meta?.bufferSize).toBe(0);
    expect(texts(store.getMessages('device-2', {}))).toEqual(['other']);
  });
});
