import { describe, expect, it } from 'vitest';
import { keepColumnFillBase, withColumnFill } from '../columnFill';

const defaultSizes = { a: 100, name: 160, b: 100 };

describe('withColumnFill', () => {
  it('stretches the filling column to the free width', () => {
    expect(withColumnFill({ fillId: 'name', sizing: {}, defaultSizes, paneWidth: 700 })).toEqual({
      name: 500,
    });
  });

  it('never goes below the width the column was set to', () => {
    expect(
      withColumnFill({ fillId: 'name', sizing: { name: 400 }, defaultSizes, paneWidth: 500 }),
    ).toEqual({ name: 400 });
    expect(withColumnFill({ fillId: 'name', sizing: {}, defaultSizes, paneWidth: 0 })).toEqual({
      name: 160,
    });
  });

  it('gives way when another column grows, down to its own width', () => {
    expect(
      withColumnFill({ fillId: 'name', sizing: { a: 300 }, defaultSizes, paneWidth: 700 }),
    ).toEqual({ a: 300, name: 300 });
    expect(
      withColumnFill({ fillId: 'name', sizing: { a: 600 }, defaultSizes, paneWidth: 700 }),
    ).toEqual({ a: 600, name: 160 });
  });
});

describe('keepColumnFillBase', () => {
  it('keeps the base when another column was resized and the filling one only stretched', () => {
    expect(
      keepColumnFillBase({
        fillId: 'name',
        previous: {},
        laidOut: { name: 500 },
        next: { name: 500, a: 140 },
      }),
    ).toEqual({ a: 140 });
    expect(
      keepColumnFillBase({
        fillId: 'name',
        previous: { name: 200 },
        laidOut: { name: 500 },
        next: { name: 500, a: 140 },
      }),
    ).toEqual({ a: 140, name: 200 });
  });

  it('takes a width the person gave the filling column', () => {
    expect(
      keepColumnFillBase({
        fillId: 'name',
        previous: {},
        laidOut: { name: 500 },
        next: { name: 540 },
      }),
    ).toEqual({ name: 540 });
  });

  it('forgets the base when the column is reset', () => {
    expect(
      keepColumnFillBase({
        fillId: 'name',
        previous: { name: 300 },
        laidOut: { name: 500 },
        next: {},
      }),
    ).toEqual({});
  });
});
