// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryField, normalizeQueryTokens, type QueryToken } from './query-field';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const renderField = (props: Partial<ComponentProps<typeof QueryField>> = {}) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<QueryField value="" onChange={() => {}} {...props} />);
  });

  return container;
};

const mirrorText = (view: HTMLElement) =>
  view.querySelector('[data-slot="query-field-mirror"]')?.textContent ?? '';

describe('normalizeQueryTokens', () => {
  it('returns one segment per accepted token, in order', () => {
    const tokens: QueryToken[] = [
      { start: 0, end: 5, kind: 'field' },
      { start: 5, end: 7, kind: 'operator' },
      { start: 7, end: 11, kind: 'value' },
    ];

    expect(normalizeQueryTokens('level>=warn', tokens)).toEqual([
      { start: 0, end: 5, kind: 'field' },
      { start: 5, end: 7, kind: 'operator' },
      { start: 7, end: 11, kind: 'value' },
    ]);
  });

  it('fills gaps between tokens with unstyled segments', () => {
    const tokens: QueryToken[] = [{ start: 4, end: 8, kind: 'value' }];

    expect(normalizeQueryTokens('abcdefghij', tokens)).toEqual([
      { start: 0, end: 4, kind: null },
      { start: 4, end: 8, kind: 'value' },
      { start: 8, end: 10, kind: null },
    ]);
  });

  it('returns a single unstyled segment when there are no tokens', () => {
    expect(normalizeQueryTokens('hello', [])).toEqual([{ start: 0, end: 5, kind: null }]);
  });

  it('returns nothing for an empty value regardless of tokens', () => {
    expect(normalizeQueryTokens('', [{ start: 0, end: 5, kind: 'field' }])).toEqual([]);
  });

  it('clamps out-of-range start/end into the value bounds', () => {
    const tokens: QueryToken[] = [{ start: -5, end: 100, kind: 'field' }];

    expect(normalizeQueryTokens('abc', tokens)).toEqual([{ start: 0, end: 3, kind: 'field' }]);
  });

  it('drops zero-length ranges', () => {
    const tokens: QueryToken[] = [{ start: 2, end: 2, kind: 'field' }];

    expect(normalizeQueryTokens('abcdef', tokens)).toEqual([{ start: 0, end: 6, kind: null }]);
  });

  it('drops inverted ranges', () => {
    const tokens: QueryToken[] = [{ start: 5, end: 1, kind: 'field' }];

    expect(normalizeQueryTokens('abcdef', tokens)).toEqual([{ start: 0, end: 6, kind: null }]);
  });

  it('drops a later token that overlaps one already accepted — first wins', () => {
    const tokens: QueryToken[] = [
      { start: 0, end: 5, kind: 'field' },
      { start: 3, end: 8, kind: 'error' },
    ];

    expect(normalizeQueryTokens('abcdefgh', tokens)).toEqual([
      { start: 0, end: 5, kind: 'field' },
      { start: 5, end: 8, kind: null },
    ]);
  });

  it('drops a token nested entirely inside one already accepted', () => {
    const tokens: QueryToken[] = [
      { start: 0, end: 8, kind: 'field' },
      { start: 2, end: 4, kind: 'error' },
    ];

    expect(normalizeQueryTokens('abcdefgh', tokens)).toEqual([{ start: 0, end: 8, kind: 'field' }]);
  });

  it('accepts adjacent, non-overlapping tokens (start === previous end)', () => {
    const tokens: QueryToken[] = [
      { start: 0, end: 4, kind: 'field' },
      { start: 4, end: 8, kind: 'value' },
    ];

    expect(normalizeQueryTokens('abcdefgh', tokens)).toEqual([
      { start: 0, end: 4, kind: 'field' },
      { start: 4, end: 8, kind: 'value' },
    ]);
  });

  it('resolves ties at the same start by accepted order, honoring first-wins after sort', () => {
    const tokens: QueryToken[] = [
      { start: 2, end: 3, kind: 'field' },
      { start: 2, end: 8, kind: 'error' },
    ];

    expect(normalizeQueryTokens('abcdefgh', tokens)).toEqual([
      { start: 0, end: 2, kind: null },
      { start: 2, end: 3, kind: 'field' },
      { start: 3, end: 8, kind: null },
    ]);
  });

  it('never drops or duplicates characters for a fuzz-ish set of awkward token inputs', () => {
    const value = 'level>=warn tag:auth -"retry" extra garbage 1234567890';
    const awkwardTokenSets: QueryToken[][] = [
      [],
      [{ start: 0, end: 0, kind: 'field' }],
      [{ start: 5, end: 5, kind: 'field' }],
      [{ start: -10, end: -1, kind: 'field' }],
      [{ start: 1000, end: 2000, kind: 'field' }],
      [{ start: -10, end: 1000, kind: 'field' }],
      [
        { start: 0, end: 5, kind: 'field' },
        { start: 0, end: 5, kind: 'operator' },
      ],
      [
        { start: 0, end: 20, kind: 'field' },
        { start: 5, end: 10, kind: 'operator' },
        { start: 15, end: 25, kind: 'value' },
      ],
      [
        { start: 10, end: 5, kind: 'error' },
        { start: 0, end: value.length, kind: 'text' },
      ],
      Array.from({ length: 20 }, (_, index) => ({
        start: index * 2,
        end: index * 2 + 3,
        kind: (index % 2 === 0 ? 'field' : 'value') as QueryToken['kind'],
      })),
    ];

    for (const tokens of awkwardTokenSets) {
      const segments = normalizeQueryTokens(value, tokens);
      const rebuilt = segments.map((segment) => value.slice(segment.start, segment.end)).join('');

      expect(rebuilt).toBe(value);

      // Segments must be contiguous and non-overlapping, covering [0, length).
      let expectedStart = 0;
      for (const segment of segments) {
        expect(segment.start).toBe(expectedStart);
        expect(segment.end).toBeGreaterThan(segment.start);
        expectedStart = segment.end;
      }
      expect(expectedStart).toBe(value.length);
    }
  });
});

describe('QueryField', () => {
  it('paints token ranges into the mirror with the right classes', () => {
    const tokens: QueryToken[] = [
      { start: 0, end: 5, kind: 'field' },
      { start: 5, end: 7, kind: 'operator' },
      { start: 7, end: 11, kind: 'value' },
    ];
    const view = renderField({ value: 'level>=warn', tokens });
    const spans = view.querySelectorAll('[data-slot="query-field-mirror"] span');

    expect(spans).toHaveLength(3);
    expect(spans[0]?.textContent).toBe('level');
    expect(spans[0]?.className).toContain('text-primary');
    expect(spans[1]?.textContent).toBe('>=');
    expect(spans[1]?.className).toContain('text-muted-foreground');
    expect(spans[2]?.textContent).toBe('warn');
    expect(spans[2]?.className).toContain('text-foreground');
  });

  // jsdom computes no layout, so these two can only be guarded structurally.
  // Both were real misalignment bugs: a block mirror paints its text above an
  // input's vertically-centered line, and a non-flex wrapper drops the
  // absolutely-positioned clear button at the top of the field.
  it('centers the mirror and the clear button against the input line', () => {
    const view = renderField({ value: 'tag:auth', onClear: () => {} });

    expect(view.querySelector('[data-slot="query-field-mirror"]')?.className).toContain(
      'items-center',
    );
    expect(view.querySelector('[data-slot="query-field"]')?.className).toContain('items-center');
  });

  it('renders an unstyled span for gaps outside any token', () => {
    const tokens: QueryToken[] = [{ start: 6, end: 10, kind: 'value' }];
    const view = renderField({ value: 'tag:auth extra', tokens });
    const spans = view.querySelectorAll('[data-slot="query-field-mirror"] span');

    expect(spans[0]?.textContent).toBe('tag:au');
    expect(spans[0]?.className).toBe('');
  });

  it('marks an error token with the danger/wavy-underline treatment', () => {
    const tokens: QueryToken[] = [{ start: 0, end: 4, kind: 'error' }];
    const view = renderField({ value: 'bad(', tokens });
    const span = view.querySelector('[data-slot="query-field-mirror"] span');

    expect(span?.className).toContain('text-danger');
    expect(span?.className).toContain('decoration-wavy');
  });

  it('never corrupts the rendered text for out-of-range, inverted, zero-length, and overlapping tokens', () => {
    const value = 'level>=warn tag:auth -"retry"';
    const tokens: QueryToken[] = [
      { start: -20, end: 5, kind: 'field' },
      { start: 3, end: 3, kind: 'error' },
      { start: 10, end: 2, kind: 'error' },
      { start: 5, end: 500, kind: 'operator' },
      { start: 5, end: 8, kind: 'value' },
    ];
    const view = renderField({ value, tokens });

    expect(mirrorText(view)).toBe(value);
  });

  it('fires onValueChange with the new value', () => {
    const onValueChange = vi.fn();
    const view = renderField({ value: 'lev', onValueChange });
    const input = view.querySelector('[data-slot="query-field-input"]') as HTMLInputElement;
    // React tracks the DOM value setter to detect real changes, so setting
    // `input.value` directly is a no-op from its perspective — go through
    // the native setter, as React Testing Library's fireEvent does.
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    act(() => {
      nativeValueSetter?.call(input, 'level');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('level');
  });

  it('highlights with the built-in grammar when no tokens are given', () => {
    const view = renderField({ value: 'level>=warn -"retry"' });
    const spans = Array.from(view.querySelectorAll('[data-slot="query-field-mirror"] span'));

    expect(spans.map((span) => span.textContent)).toEqual([
      'level',
      '>=',
      'warn',
      ' ',
      '-',
      '"retry"',
    ]);
    expect(spans[0]?.className).toContain('text-primary');
    expect(spans[1]?.className).toContain('text-muted-foreground');
    expect(spans[4]?.className).toContain('text-warning');
  });

  it('re-tokenizes on every value, so highlighting follows an edited query', () => {
    // The bug this guards: token ranges computed once for the initial value
    // keep painting the same offsets after the text around them changes.
    const view = renderField({ value: 'level:warn' });
    const fieldSpan = () => view.querySelector('[data-slot="query-field-mirror"] span');

    expect(fieldSpan()?.textContent).toBe('level');

    act(() => {
      root?.render(<QueryField value="lvl:warn" onChange={() => {}} />);
    });

    expect(fieldSpan()?.textContent).toBe('lvl');
  });

  it('lets caller tokens replace the built-in grammar, and [] disable it', () => {
    const overridden = renderField({
      value: 'level:warn',
      tokens: [{ start: 0, end: 10, kind: 'error' }],
    });
    const overriddenSpans = overridden.querySelectorAll('[data-slot="query-field-mirror"] span');

    expect(overriddenSpans).toHaveLength(1);
    expect(overriddenSpans[0]?.className).toContain('text-danger');

    act(() => root?.unmount());
    container?.remove();

    const bare = renderField({ value: 'level:warn', tokens: [] });
    const bareSpans = bare.querySelectorAll('[data-slot="query-field-mirror"] span');

    expect(bareSpans).toHaveLength(1);
    expect(bareSpans[0]?.textContent).toBe('level:warn');
    expect(bareSpans[0]?.className).toBe('');
  });

  // jsdom computes no layout, so the overflow fix can only be guarded
  // structurally. The bug: with the input spanning the whole field, a long
  // query scrolled straight under the clear button and buried it.
  it('scrolls the text inside a lane that stops short of the clear button', () => {
    const view = renderField({ value: 'level>=warn tag:auth', onClear: () => {} });
    const lane = view.querySelector('[data-slot="query-field-lane"]') as HTMLElement;
    const input = view.querySelector('[data-slot="query-field-input"]') as HTMLInputElement;
    const mirror = view.querySelector('[data-slot="query-field-mirror"]') as HTMLElement;
    const clear = view.querySelector('[data-slot="query-field-clear"]') as HTMLElement;

    // Both layers live in the lane, and the button is the lane's sibling in
    // flow — not an overlay on top of the scrolling text.
    expect(lane.contains(input)).toBe(true);
    expect(lane.contains(mirror)).toBe(true);
    expect(clear.parentElement).toBe(view.querySelector('[data-slot="query-field"]'));
    expect(clear.className).not.toContain('absolute');
    // No reserved padding to scroll into: the lane itself is the clip.
    expect(input.className).not.toMatch(/(^|[\s:])pr-/);
    expect(mirror.className).not.toMatch(/(^|[\s:])pr-/);
  });

  it('keeps the mirror scrolled to the input as the caret moves past the edge', () => {
    const view = renderField({ value: 'level>=warn tag:auth service:checkout' });
    const input = view.querySelector('[data-slot="query-field-input"]') as HTMLInputElement;
    const mirror = view.querySelector('[data-slot="query-field-mirror"]') as HTMLElement;

    input.scrollLeft = 120;
    act(() => {
      input.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(mirror.scrollLeft).toBe(120);
  });

  it('focuses the input when the surface padding is pressed', () => {
    const view = renderField({ value: 'level' });
    const surface = view.querySelector('[data-slot="query-field"]') as HTMLElement;
    const input = view.querySelector('[data-slot="query-field-input"]') as HTMLInputElement;

    act(() => {
      surface.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    expect(document.activeElement).toBe(input);
  });

  it('shows the clear button only when onClear and a non-empty value are both present', () => {
    const withoutOnClear = renderField({ value: 'level' });
    expect(withoutOnClear.querySelector('[data-slot="query-field-clear"]')).toBeNull();

    act(() => root?.unmount());
    container?.remove();

    const withEmptyValue = renderField({ value: '', onClear: () => {} });
    expect(withEmptyValue.querySelector('[data-slot="query-field-clear"]')).toBeNull();

    act(() => root?.unmount());
    container?.remove();

    const onClear = vi.fn();
    const withBoth = renderField({ value: 'level', onClear });
    const clearButton = withBoth.querySelector(
      '[data-slot="query-field-clear"]',
    ) as HTMLButtonElement;

    expect(clearButton).not.toBeNull();
    act(() => clearButton.click());
    expect(onClear).toHaveBeenCalledOnce();
  });
});
