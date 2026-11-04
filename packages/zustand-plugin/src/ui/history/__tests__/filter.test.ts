import { describe, expect, it } from 'vitest';
import type { TransitionSource } from '../../../shared/protocol';
import { matchesFilter, parseFilter } from '../filter';

const row = (storeName: string, actionName: string, source: TransitionSource = 'action') => ({
  storeName,
  actionName,
  source,
});

const visible = (query: string, rows: ReturnType<typeof row>[]) =>
  rows
    .filter((subject) => matchesFilter(parseFilter(query), subject))
    .map((subject) => `${subject.storeName}/${subject.actionName}`);

describe('timeline filter', () => {
  const rows = [
    row('ScrollPosition', 'setOffset'),
    row('Feed', 'scrollToTop'),
    row('Cart', 'addItem'),
    row('Cart', 'persist/rehydrate', 'hydrate'),
  ];

  it('matches bare terms and globs against the action name only', () => {
    expect(visible('-scroll', rows)).toEqual([
      'ScrollPosition/setOffset',
      'Cart/addItem',
      'Cart/persist/rehydrate',
    ]);
    expect(visible('cart', rows)).toEqual([]);
    expect(visible('*Item', rows)).toEqual(['Cart/addItem']);
  });

  it('matches terms with a slash or dot against the store-qualified name', () => {
    expect(visible('cart/*', rows)).toEqual(['Cart/addItem', 'Cart/persist/rehydrate']);
    expect(visible('Cart.add', rows)).toEqual(['Cart/addItem']);
    expect(visible('persist/rehydrate', rows)).toEqual(['Cart/persist/rehydrate']);
  });

  it('filters by store and source with their keys', () => {
    expect(visible('store:scroll', rows)).toEqual(['ScrollPosition/setOffset']);
    expect(visible('-source:hydrate store:cart', rows)).toEqual(['Cart/addItem']);
  });
});
