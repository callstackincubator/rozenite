import { describe, expect, it } from 'vitest';
import { toChangedKeys, toChangeTypeHints } from '../agent/runtime/react/store.js';

describe('toChangeTypeHints', () => {
  it('lists every category that changed', () => {
    expect(
      toChangeTypeHints({
        isFirstMount: false,
        props: ['data', 'isSelected'],
        state: ['count'],
        context: ['ThemeContext'],
        didHooksChange: true,
      }),
    ).toEqual(['props', 'state', 'context', 'hooks']);
  });

  it('reports "mount" for the initial mount', () => {
    expect(
      toChangeTypeHints({
        isFirstMount: true,
        props: null,
        state: null,
        context: null,
        didHooksChange: false,
      }),
    ).toEqual(['mount']);
  });

  it('treats context === true as a context change', () => {
    expect(
      toChangeTypeHints({
        isFirstMount: false,
        props: null,
        state: null,
        context: true,
        didHooksChange: false,
      }),
    ).toEqual(['context']);
  });

  it('ignores empty arrays', () => {
    expect(
      toChangeTypeHints({
        isFirstMount: false,
        props: [],
        state: [],
        context: [],
        didHooksChange: false,
      }),
    ).toEqual([]);
  });
});

describe('toChangedKeys', () => {
  it('returns the exact changed prop and state key names', () => {
    expect(
      toChangedKeys({
        isFirstMount: false,
        props: ['data', 'isSelected'],
        state: ['count'],
        context: null,
        didHooksChange: false,
      }),
    ).toEqual({ props: ['data', 'isSelected'], state: ['count'] });
  });

  it('returns the context display names when available', () => {
    expect(
      toChangedKeys({
        isFirstMount: false,
        props: null,
        state: null,
        context: ['ThemeContext'],
        didHooksChange: false,
      }),
    ).toEqual({ context: ['ThemeContext'] });
  });

  it('returns context: true when React only reports that some context changed', () => {
    expect(
      toChangedKeys({
        isFirstMount: false,
        props: null,
        state: null,
        context: true,
        didHooksChange: false,
      }),
    ).toEqual({ context: true });
  });

  it('flags hooks and first mount', () => {
    expect(
      toChangedKeys({
        isFirstMount: true,
        props: null,
        state: null,
        context: null,
        didHooksChange: true,
      }),
    ).toEqual({ isFirstMount: true, hooks: true });
  });

  it('returns undefined when nothing meaningful changed', () => {
    expect(
      toChangedKeys({
        isFirstMount: false,
        props: [],
        state: null,
        context: null,
        didHooksChange: false,
      }),
    ).toBeUndefined();
  });

  it('returns undefined for a missing change description', () => {
    expect(toChangedKeys(null)).toBeUndefined();
    expect(toChangedKeys(undefined)).toBeUndefined();
  });
});
