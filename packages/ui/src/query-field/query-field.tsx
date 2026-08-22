import type { ChangeEvent, ComponentProps, MouseEvent, UIEvent } from 'react';
import { useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';
import { tokenizeQuery } from './query-grammar';
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
  // `text` mirrors `fieldSurface`'s own size scale. It is applied to both
  // layers from this one place so the painted text and the caret can never
  // end up at different font sizes.
  sm: { text: 'text-xs', gap: 'gap-1', clear: 'size-3.5', clearIcon: 'size-3' },
  md: { text: 'text-sm', gap: 'gap-1.5', clear: 'size-4', clearIcon: 'size-3.5' },
  lg: { text: 'text-base', gap: 'gap-2', clear: 'size-5', clearIcon: 'size-4' },
} as const satisfies Record<Size, unknown>;

export type QueryFieldProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Ranges to highlight, for a caller that owns its own query language.
   *  Ranges outside the value, or overlapping an earlier token, are ignored;
   *  unclaimed spans render as plain text. Omit to highlight with the
   *  built-in grammar (`tokenizeQuery`), which re-reads the value on every
   *  keystroke. Pass `[]` for no highlighting at all. */
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
 * A query input that highlights the parts of a query as the reader types —
 * field names, operators, values, negation, free text, malformed fragments.
 *
 * Out of the box it highlights the small filter grammar `tokenizeQuery`
 * understands (`level>=warn tag:auth -"retry"`), re-tokenizing the value on
 * every keystroke so the colors follow the text as it is edited. A panel that
 * owns a different query language passes its own `tokens` instead, and the
 * built-in grammar is bypassed — `QueryField` then only paints the ranges it
 * is handed.
 *
 * Built with the overlay-mirror technique: an `aria-hidden` mirror underneath
 * paints the colored spans, and the real `<input>` sits on top with
 * transparent text and a visible caret, so typing, selection, and IME
 * composition all behave like a normal input. Both layers are absolutely
 * positioned inside the same box and share one monospace font size, so the
 * painted text never drifts from the caret; a `scroll` listener keeps the
 * mirror in sync when the value is wider than the field.
 *
 * The field surface — border, focus ring, height, padding — lives on the
 * wrapper rather than on the `<input>`, so `className` styles the field as a
 * whole. Every other prop goes to the input.
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
  const segments = useMemo(
    () => normalizeQueryTokens(text, tokens ?? tokenizeQuery(text)),
    [text, tokens],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    onValueChange?.(event.target.value);
  };

  const handleScroll = (event: UIEvent<HTMLInputElement>) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  // The input spans the text lane, not the whole field, so a press on the
  // surface's padding lands on the wrapper instead of the input. A native
  // input focuses when its padding is clicked; match that. Reading the input
  // off the event keeps a caller-supplied `ref` free for the caller.
  const handleSurfaceMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    event.currentTarget.querySelector('input')?.focus();
  };

  return (
    // The surface lives here, so the text lane can stop short of the clear
    // button: an overflowing query then scrolls *inside* the lane instead of
    // running underneath the button and burying it.
    <div
      data-slot="query-field"
      onMouseDown={handleSurfaceMouseDown}
      className={cn(
        fieldSurface({ size }),
        'flex items-center',
        sizing.gap,
        // The chrome reacts to the input it wraps, since the input itself no
        // longer carries the border or the ring.
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/50',
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        className,
      )}
    >
      <div data-slot="query-field-lane" className="relative h-full min-w-0 flex-1">
        <div
          aria-hidden="true"
          data-slot="query-field-mirror"
          ref={mirrorRef}
          className={cn(
            // `items-center` is load-bearing: an input centers its single line
            // of text vertically, a block box does not, so a block mirror
            // paints the text several pixels above the caret. Centering with
            // flex keeps the two layers aligned without hardcoding a line
            // height per size.
            'pointer-events-none absolute inset-0 flex items-center overflow-hidden font-mono whitespace-pre',
            sizing.text,
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
            'absolute inset-0 border-0 bg-transparent p-0 font-mono text-transparent outline-none',
            'caret-foreground selection:bg-primary/30 placeholder:text-muted-foreground',
            'disabled:pointer-events-none disabled:cursor-not-allowed',
            sizing.text,
          )}
          {...props}
        />
      </div>
      {showClear && (
        <button
          type="button"
          data-slot="query-field-clear"
          onClick={onClear}
          aria-label={clearLabel}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
            sizing.clear,
          )}
        >
          <X className={sizing.clearIcon} />
        </button>
      )}
    </div>
  );
}
