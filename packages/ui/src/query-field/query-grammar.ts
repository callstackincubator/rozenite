import type { QueryToken, QueryTokenKind } from './query-field';

/**
 * The operators the built-in grammar recognizes, longest first so that `>=`
 * wins over `>` and `!=` over a bare `!`.
 */
const OPERATORS = ['!=', '>=', '<=', '=~', ':', '=', '>', '<'] as const;

/** Opens a quoted value. A quoted run ends at the matching quote. */
const QUOTES = new Set(['"', "'"]);

/** Marks a term as negated when it leads one: `-warn`, `!tag:auth`. */
const NEGATIONS = new Set(['-', '!']);

/**
 * A field name: a leading letter or underscore, then word characters, dots,
 * and dashes — enough for `level`, `user.id`, and `x-request-id`. It is only
 * painted as a field when an operator follows it directly.
 */
const FIELD_NAME = /[A-Za-z_][A-Za-z0-9_.-]*/y;

const isWhitespace = (char: string | undefined) => char !== undefined && /\s/.test(char);

const matchOperator = (value: string, index: number): string | undefined =>
  OPERATORS.find((operator) => value.startsWith(operator, index));

/**
 * Scans a quoted run starting at the opening quote. A backslash escapes the
 * next character, so `"a\"b"` is one value. A run that reaches the end of the
 * string without its closing quote comes back `closed: false`.
 */
const scanQuoted = (value: string, index: number): { end: number; closed: boolean } => {
  const quote = value[index];
  let cursor = index + 1;

  while (cursor < value.length) {
    if (value[cursor] === '\\') {
      cursor += 2;
      continue;
    }

    if (value[cursor] === quote) {
      return { end: cursor + 1, closed: true };
    }

    cursor += 1;
  }

  return { end: value.length, closed: false };
};

/**
 * Reads one operand — the right-hand side of a clause, or a term standing on
 * its own — and pushes its token. Quoted operands are values whichever side
 * they appear on; an unterminated quote is the one thing this grammar calls
 * an error. Returns the offset just past the operand.
 */
const readOperand = (
  value: string,
  index: number,
  tokens: QueryToken[],
  unquotedKind: QueryTokenKind,
): number => {
  if (index >= value.length || isWhitespace(value[index])) {
    return index;
  }

  if (QUOTES.has(value[index])) {
    const { end, closed } = scanQuoted(value, index);
    tokens.push({ start: index, end, kind: closed ? 'value' : 'error' });
    return end;
  }

  let end = index;
  while (end < value.length && !isWhitespace(value[end])) {
    end += 1;
  }

  tokens.push({ start: index, end, kind: unquotedKind });
  return end;
};

/**
 * Tokenizes a query written in the small filter grammar `QueryField` paints by
 * default:
 *
 * ```text
 * query    := term*
 * term     := negation? (clause | operand)
 * clause   := field operator operand?
 * negation := '-' | '!'
 * operator := ':' | '=' | '!=' | '>=' | '<=' | '=~' | '>' | '<'
 * operand  := quoted | run-of-non-whitespace
 * ```
 *
 * So `level>=warn tag:auth -"retry" freetext` paints as field/operator/value,
 * field/operator/value, negation/value, and plain text. Only an unterminated
 * quote is reported as an `error`: a half-typed clause like `level>=` is a
 * query in progress, not a mistake, and flagging it while the reader types
 * would cry wolf.
 *
 * Offsets are recomputed from the value on every call, so highlighting tracks
 * the text as it is edited — which is the whole point of having a grammar
 * here rather than fixed ranges. Whitespace between terms is left unclaimed
 * and rendered as plain text.
 *
 * A panel with its own query language passes `tokens` to `QueryField`
 * instead, and this grammar is bypassed entirely.
 */
export function tokenizeQuery(value: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  let index = 0;

  while (index < value.length) {
    const char = value[index];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    // A negation only leads a term, so `-` is a sign here but an ordinary
    // character inside `region:us-east-1`. A trailing `-` with nothing after
    // it negates nothing and falls through to be read as text.
    if (NEGATIONS.has(char) && index + 1 < value.length && !isWhitespace(value[index + 1])) {
      tokens.push({ start: index, end: index + 1, kind: 'negation' });
      index += 1;
      continue;
    }

    FIELD_NAME.lastIndex = index;
    const fieldMatch = FIELD_NAME.exec(value);

    if (fieldMatch) {
      const fieldEnd = index + fieldMatch[0].length;
      const operator = matchOperator(value, fieldEnd);

      if (operator) {
        tokens.push({ start: index, end: fieldEnd, kind: 'field' });
        tokens.push({ start: fieldEnd, end: fieldEnd + operator.length, kind: 'operator' });
        index = readOperand(value, fieldEnd + operator.length, tokens, 'value');
        continue;
      }
    }

    // No operator follows, so the term is free text rather than a clause.
    index = readOperand(value, index, tokens, 'text');
  }

  return tokens;
}
