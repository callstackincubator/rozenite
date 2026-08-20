import { describe, expect, it } from 'vitest';
import { CircularBuffer } from '../agent/runtime/collections/circular-buffer.js';

const drain = <T>(iterator: IterableIterator<[number, T]>): [number, T][] => [...iterator];

describe('CircularBuffer', () => {
  it('rejects a non-positive capacity', () => {
    expect(() => new CircularBuffer(0)).toThrow(RangeError);
    expect(() => new CircularBuffer(-1)).toThrow(RangeError);
    expect(() => new CircularBuffer(1.5)).toThrow(RangeError);
  });

  it('assigns dense increasing indices and reads them back', () => {
    const buffer = new CircularBuffer<string>(4);

    expect(buffer.append('a')).toBe(0);
    expect(buffer.append('b')).toBe(1);

    expect(buffer.size).toBe(2);
    expect(buffer.first).toBe(0);
    expect(buffer.next).toBe(2);
    expect(buffer.at(0)).toBe('a');
    expect(buffer.at(1)).toBe('b');
    expect(buffer.at(2)).toBeUndefined();
  });

  it('keeps indices monotonic and O(1) addressable after wraparound', () => {
    const buffer = new CircularBuffer<number>(3);
    for (let i = 0; i < 10; i += 1) {
      expect(buffer.append(i)).toBe(i);
    }

    expect(buffer.size).toBe(3);
    expect(buffer.first).toBe(7);
    expect(buffer.next).toBe(10);
    expect(buffer.at(7)).toBe(7);
    expect(buffer.at(9)).toBe(9);
    // Evicted indices stay meaningful; they just no longer resolve.
    expect(buffer.has(6)).toBe(false);
    expect(buffer.at(6)).toBeUndefined();
  });

  it('handles a capacity of one', () => {
    const buffer = new CircularBuffer<string>(1);
    buffer.append('a');
    buffer.append('b');

    expect(buffer.size).toBe(1);
    expect(buffer.at(0)).toBeUndefined();
    expect(buffer.at(1)).toBe('b');
  });

  it('walks in both directions and clamps the start into the window', () => {
    const buffer = new CircularBuffer<number>(3);
    for (let i = 0; i < 5; i += 1) {
      buffer.append(i);
    }

    expect(drain(buffer.from(2, 'asc'))).toEqual([
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
    expect(drain(buffer.from(4, 'desc'))).toEqual([
      [4, 4],
      [3, 3],
      [2, 2],
    ]);
    // Below the window when ascending, above it when descending.
    expect(drain(buffer.from(0, 'asc'))).toHaveLength(3);
    expect(drain(buffer.from(99, 'desc'))).toHaveLength(3);
    // Past the window in the direction of travel yields nothing.
    expect(drain(buffer.from(99, 'asc'))).toEqual([]);
    expect(drain(buffer.from(0, 'desc'))).toEqual([]);
  });

  it('yields nothing while empty', () => {
    const buffer = new CircularBuffer<number>(3);
    expect(drain(buffer.from(0, 'asc'))).toEqual([]);
    expect(drain(buffer.from(0, 'desc'))).toEqual([]);
  });

  it('keeps the index space monotonic across clear and refill', () => {
    const buffer = new CircularBuffer<string>(3);
    buffer.append('a');
    buffer.append('b');
    buffer.clear();

    expect(buffer.size).toBe(0);
    expect(buffer.first).toBe(2);
    expect(buffer.next).toBe(2);
    expect(buffer.at(0)).toBeUndefined();
    expect(buffer.at(1)).toBeUndefined();

    expect(buffer.append('c')).toBe(2);
    expect(buffer.at(2)).toBe('c');
    expect(drain(buffer.from(0, 'asc'))).toEqual([[2, 'c']]);
  });

  it('releases references to evicted entries', () => {
    const buffer = new CircularBuffer<string>(2);
    buffer.append('a');
    buffer.append('b');
    buffer.clear();

    // Nothing in the window, so nothing is reachable through the public API.
    expect(buffer.size).toBe(0);
    expect(drain(buffer.from(buffer.first, 'asc'))).toEqual([]);
  });
});
