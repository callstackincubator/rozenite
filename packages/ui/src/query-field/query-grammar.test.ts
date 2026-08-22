import { describe, expect, it } from 'vitest';
import { tokenizeQuery } from './query-grammar';
import { normalizeQueryTokens } from './query-field';

/** Renders a tokenization as `kind:slice` pairs, which reads far better in a
 *  failure than a wall of offsets. */
const painted = (value: string) =>
  tokenizeQuery(value).map((token) => `${token.kind}:${value.slice(token.start, token.end)}`);

describe('tokenizeQuery', () => {
  it('splits a clause into field, operator, and value', () => {
    expect(painted('level:warn')).toEqual(['field:level', 'operator::', 'value:warn']);
  });

  it('recognizes the comparison and match operators', () => {
    expect(painted('a>=1 b<=2 c>3 d<4 e=5 f!=6 g=~7')).toEqual([
      'field:a',
      'operator:>=',
      'value:1',
      'field:b',
      'operator:<=',
      'value:2',
      'field:c',
      'operator:>',
      'value:3',
      'field:d',
      'operator:<',
      'value:4',
      'field:e',
      'operator:=',
      'value:5',
      'field:f',
      'operator:!=',
      'value:6',
      'field:g',
      'operator:=~',
      'value:7',
    ]);
  });

  it('paints a word with no operator as free text', () => {
    expect(painted('checkout timeout')).toEqual(['text:checkout', 'text:timeout']);
  });

  it('paints a leading - or ! as negation', () => {
    expect(painted('-warn !tag:auth')).toEqual([
      'negation:-',
      'text:warn',
      'negation:!',
      'field:tag',
      'operator::',
      'value:auth',
    ]);
  });

  it('keeps dashes inside a value rather than reading them as negation', () => {
    expect(painted('region:us-east-1')).toEqual(['field:region', 'operator::', 'value:us-east-1']);
  });

  it('accepts dotted and dashed field names', () => {
    expect(painted('user.id:8231 x-request-id:abc')).toEqual([
      'field:user.id',
      'operator::',
      'value:8231',
      'field:x-request-id',
      'operator::',
      'value:abc',
    ]);
  });

  it('treats a quoted run as a single value, on either side of an operator', () => {
    expect(painted('msg:"could not connect" -"retry now"')).toEqual([
      'field:msg',
      'operator::',
      'value:"could not connect"',
      'negation:-',
      'value:"retry now"',
    ]);
  });

  it('honors single quotes and backslash escapes inside a quoted run', () => {
    expect(painted(`msg:'it\\'s fine' next`)).toEqual([
      'field:msg',
      'operator::',
      `value:'it\\'s fine'`,
      'text:next',
    ]);
  });

  it('flags an unterminated quote as an error', () => {
    expect(painted('tag:"auth')).toEqual(['field:tag', 'operator::', 'error:"auth']);
  });

  it('leaves a half-typed clause unflagged — a query in progress is not a typo', () => {
    expect(painted('level>=')).toEqual(['field:level', 'operator:>=']);
    expect(painted('level>= tag:auth')).toEqual([
      'field:level',
      'operator:>=',
      'field:tag',
      'operator::',
      'value:auth',
    ]);
  });

  it('reads a trailing negation sign with nothing after it as text', () => {
    expect(painted('warn -')).toEqual(['text:warn', 'text:-']);
    expect(painted('warn - x')).toEqual(['text:warn', 'text:-', 'text:x']);
  });

  it('returns no tokens for an empty or whitespace-only query', () => {
    expect(tokenizeQuery('')).toEqual([]);
    expect(tokenizeQuery('   \t ')).toEqual([]);
  });

  it('leaves the whitespace between terms unclaimed', () => {
    expect(tokenizeQuery('a:1  b:2').map((token) => [token.start, token.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [5, 6],
      [6, 7],
      [7, 8],
    ]);
  });

  it('re-reads offsets from the value, so a shorter field shifts everything after it', () => {
    // The bug this guards: fixed ranges computed once for `level:warn` keep
    // painting offsets 0-5 as the field after the value is edited down.
    expect(painted('lvl:warn')).toEqual(['field:lvl', 'operator::', 'value:warn']);
    expect(painted('l:warn')).toEqual(['field:l', 'operator::', 'value:warn']);
    expect(painted('a_very_long_field_name:warn')).toEqual([
      'field:a_very_long_field_name',
      'operator::',
      'value:warn',
    ]);
  });

  it('produces tokens that always reconstruct the value exactly', () => {
    const queries = [
      '',
      ' ',
      '-',
      '!',
      '--',
      ':',
      '::',
      'a',
      'a:',
      ':a',
      '"',
      "'''",
      '\\',
      'a:"',
      '-!a:>=1',
      'level>=warn tag:auth -"retry" free text 1234',
      'msg:"unterminated tag:auth',
      'a:1\tb:2\n c:3',
      '日本語:テスト -"引用"',
      '👋:wave',
    ];

    for (const query of queries) {
      const segments = normalizeQueryTokens(query, tokenizeQuery(query));
      const rebuilt = segments.map((segment) => query.slice(segment.start, segment.end)).join('');

      expect(rebuilt).toBe(query);

      // Nothing overlapping and nothing out of order, so normalization never
      // has to drop a token the grammar produced.
      let previousEnd = 0;
      for (const token of tokenizeQuery(query)) {
        expect(token.start).toBeGreaterThanOrEqual(previousEnd);
        expect(token.end).toBeGreaterThan(token.start);
        expect(token.end).toBeLessThanOrEqual(query.length);
        previousEnd = token.end;
      }
    }
  });
});
