import type { ChangeEvent, ComponentProps, UIEvent } from 'react';
import { useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';
import { sizeHeight } from '../tokens/size';
import type { Size } from '../tokens/size';

export type QueryTokenKind = 'field' | 'operator' | 'value' | 'negation' | 'text' | 'error';

export type QueryToken = {
  /** Inclusive start offset into the field's value. */
  start: number;
  /** Exclusive end offset into the field's value. */
  end: number;
  kind: QueryTokenKind;
};

/** A slice of `value` and the kind to paint it with, or `null` for an
 *  unclaimed gap rendered as plain text. */
export type QuerySegment = {
  start: number;
  end: number;
  kind: QueryTokenKind | null;
};

/**
 * Normalizes caller-supplied token ranges against `value` into a gapless,
 * non-overlapping run of segments that together cover the whole string
 * exactly once — so the mirror can never drop or duplicate a character
 * regardless of what the caller passes in.
 *
 * - `start`/`end` are clamped into `[0, value.length]`.
 * - Zero-length or inverted ranges (`end <= start` after clamping) are dropped.
 * - Remaining tokens are sorted by `start`; a token that overlaps one
 *   already accepted is dropped — first wins.
 * - The gaps between accepted tokens come back as `kind: null` segments.
 */
export function normalizeQueryTokens(
  value: string,
  tokens: readonly QueryToken[] = [],
): QuerySegment[] {
  const length = value.length;

  if (length === 0) {
    return [];
  }

  const candidates = tokens
    .map((token) => ({
      start: Math.min(Math.max(token.start, 0), length),
      end: Math.min(Math.max(token.end, 0), length),
      kind: token.kind,
    }))
    .filter((token) => token.end > token.start)
    .sort((a, b) => a.start - b.start);

  const accepted: { start: number; end: number; kind: QueryTokenKind }[] = [];
  let cursor = 0;

  for (const token of candidates) {
    if (token.start < cursor) {
      continue;
    }
    accepted.push(token);
    cursor = token.end;
  }

  const segments: QuerySegment[] = [];
  let position = 0;

  for (const token of accepted) {
    if (token.start > position) {
      segments.push({ start: position, end: token.start, kind: null });
    }
    segments.push(token);
    position = token.end;
  }

  if (position < length) {
    segments.push({ start: position, end: length, kind: null });
  }

  return segments;
}

const queryTokenKindClass = {
  field: 'text-primary',
  operator: 'text-muted-foreground',
  value: 'text-foreground',
  negation: 'text-warning',
  text: 'text-foreground',
  error: 'text-danger underline decoration-wavy',
} as const satisfies Record<QueryTokenKind, string>;

const queryFieldSize = {
  sm: { clearPad: 'pr-6', clear: 'right-1 size-3.5', clearIcon: 'size-3' },
  md: { clearPad: 'pr-8', clear: 'right-2 size-4', clearIcon: 'size-3.5' },
  lg: { clearPad: 'pr-10', clear: 'right-2.5 size-5', clearIcon: 'size-4' },
} as const satisfies Record<Size, unknown>;

export type QueryFieldProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Ranges to highlight. Ranges outside the value, or overlapping an earlier
   *  token, are ignored. Unclaimed spans render as plain text. */
  tokens?: readonly QueryToken[];
  /** Convenience over onChange for the common controlled case. */
  onValueChange?: (value: string) => void;
  /** Called when the clear button is pressed. Omit to hide the clear affordance. */
  onClear?: () => void;
  /** Accessible name for the clear button.
   * @default 'Clear query' */
  clearLabel?: string;
  /** @default 'md' */
  size?: Size;
};

/**
 * A query input that paints caller-supplied token ranges over the raw text —
 * field names, operators, values, negation, free text, malformed fragments —
 * without knowing anything about the grammar itself. `QueryField` holds no
 * parser and no operator vocabulary; the caller (a plugin that owns a query
 * language) tokenizes and hands over ranges, `QueryField` only paints them.
 *
 * Built with the overlay-mirror technique: an `aria-hidden` mirror underneath
 * paints the colored spans, and the real `<input>` sits on top with
 * transparent text and a visible caret, so typing, selection, and IME
 * composition all behave like a normal input. Both layers share the same
 * `fieldSurface` box metrics and a monospace font so the painted text never
 * drifts from the caret; a `scroll` listener keeps the mirror in sync when
 * the value is wider than the field.
 */
export function QueryField({
  className,
  value,
  type = 'text',
  tokens,
  onChange,
  onValueChange,
  onClear,
  clearLabel = 'Clear query',
  size = 'md',
  ...props
}: QueryFieldProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const text = typeof value === 'string' ? value : (value?.toString() ?? '');
  const showClear = Boolean(onClear) && text.length > 0;
  const sizing = queryFieldSize[size];
  const segments = useMemo(() => normalizeQueryTokens(text, tokens), [text, tokens]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    onValueChange?.(event.target.value);
  };

  const handleScroll = (event: UIEvent<HTMLInputElement>) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  return (
    // `flex items-center` carries no in-flow children here — every layer is
    // absolutely positioned. It sets the *static position* of the clear
    // button so it centers vertically without a `top`, the same way
    // `SearchField` positions its own clear affordance.
    <div
      data-slot="query-field"
      className={cn('relative flex w-full items-center', sizeHeight[size])}
    >
      <div
        aria-hidden="true"
        data-slot="query-field-mirror"
        ref={mirrorRef}
        className={cn(
          fieldSurface({ size }),
          // `items-center` is load-bearing: an input centers its single line of
          // text vertically, a block box does not, so a block mirror paints the
          // text several pixels above the caret. Centering with flex keeps the
          // two layers aligned without hardcoding a line height per size.
          'pointer-events-none absolute inset-0 flex items-center overflow-hidden border-transparent bg-transparent font-mono whitespace-pre shadow-none',
          showClear && sizing.clearPad,
        )}
      >
        {segments.map((segment) => (
          <span
            key={`${segment.start}-${segment.end}`}
            className={segment.kind ? queryTokenKindClass[segment.kind] : undefined}
          >
            {text.slice(segment.start, segment.end)}
          </span>
        ))}
      </div>
      <input
        type={type}
        data-slot="query-field-input"
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        className={cn(
          fieldSurface({ size }),
          'absolute inset-0 min-w-0 font-mono text-transparent caret-foreground selection:bg-primary/30',
          showClear && sizing.clearPad,
          className,
        )}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          data-slot="query-field-clear"
          onClick={onClear}
          aria-label={clearLabel}
          className={cn(
            'absolute inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
            sizing.clear,
          )}
        >
          <X className={sizing.clearIcon} />
        </button>
      )}
    </div>
  );
}
