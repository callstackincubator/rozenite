import type { TransitionSource } from '../../shared/protocol';

/**
 * Timeline filter. Space-separated terms, all of which must hold:
 *
 * - `addItem`, `*Item` -- glob (`*` = anything) matched case-insensitively
 *   against the action name; a term without `*` matches as a substring.
 * - `cart/*`, `Cart.add` -- a term with `/` or `.` matches `Store/action`
 *   (or `Store.action`) instead. Only these reach the store name, so
 *   `-scroll` hides scroll actions, not every action of `ScrollPosition`.
 * - `-scroll` -- excludes matches.
 * - `source:async` / `-source:hydrate` -- matches the attribution source.
 * - `store:cart` -- matches the store name.
 */

export type FilterSubject = {
  storeName: string;
  actionName: string;
  source: TransitionSource;
};

type Term = {
  negate: boolean;
  field: 'action' | 'qualified' | 'source' | 'store';
  test: (value: string) => boolean;
};

const toMatcher = (pattern: string): ((value: string) => boolean) => {
  const lower = pattern.toLowerCase();
  if (!lower.includes('*')) {
    return (value) => value.toLowerCase().includes(lower);
  }
  const source = lower
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${source}$`);
  return (value) => regex.test(value.toLowerCase());
};

export const parseFilter = (query: string): Term[] =>
  query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const negate = raw.startsWith('-') && raw.length > 1;
      const body = negate ? raw.slice(1) : raw;
      const colon = body.indexOf(':');
      const key = colon > 0 ? body.slice(0, colon).toLowerCase() : '';
      if (key === 'source' || key === 'store') {
        return { negate, field: key, test: toMatcher(body.slice(colon + 1)) };
      }
      const field = /[/.]/.test(body) ? ('qualified' as const) : ('action' as const);
      return { negate, field, test: toMatcher(body) };
    });

export const matchesFilter = (terms: readonly Term[], subject: FilterSubject): boolean =>
  terms.every((term) => {
    let hit: boolean;
    if (term.field === 'source') {
      hit = term.test(subject.source);
    } else if (term.field === 'store') {
      hit = term.test(subject.storeName);
    } else if (term.field === 'qualified') {
      hit =
        term.test(`${subject.storeName}/${subject.actionName}`) ||
        term.test(`${subject.storeName}.${subject.actionName}`) ||
        // Action names can hold a slash themselves (`persist/rehydrate`).
        term.test(subject.actionName);
    } else {
      hit = term.test(subject.actionName);
    }
    return term.negate ? !hit : hit;
  });
