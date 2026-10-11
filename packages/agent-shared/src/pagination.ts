/**
 * The one list pager for Agent tools (ADR 0004, decisions 2 and 3).
 *
 * A cursor resumes *after a row*, never at an index: it carries the key of
 * the last row returned, and the next page starts after the row carrying
 * that key in the list as it is *now*. A row deleted or inserted behind the
 * cursor therefore cannot make a page skip or repeat a row. When the row is
 * gone, or the list's generation has moved on, the answer is an empty page
 * with `reset: true`, which tells the caller to restart the listing.
 *
 * Everything here must run in a browser, in Hermes and in Lynx as well as in
 * Node, so it uses no `Buffer`, no `node:` imports and no `btoa`/`atob`.
 */
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './output-shaping.js';
import type { PageResult } from './index.js';

export type CursorKey = string | number;

/** What a {@link paginateArray} cursor encodes. The encoding is opaque to callers. */
export type CursorPayload = {
  /** Key of the last row returned. */
  k: CursorKey;
  /** Scope the listing was issued for (for example a filter hash). */
  s?: string;
  /** Generation of the underlying collection the cursor was issued against. */
  g?: string | number;
};

export type PaginateArrayOptions<TItem> = {
  /** Stable identity of a row. Must be unique within the list. */
  keyOf: (row: TItem) => CursorKey;
  /** Raw `limit` argument. Defaults to 20, capped at 100. */
  limit?: unknown;
  /** Raw `cursor` argument, as returned in `page.nextCursor`. */
  cursor?: unknown;
  /**
   * Identifies what is being listed (a filter combination, a target). A
   * cursor issued for a different scope is rejected with an error.
   */
  scope?: string;
  /**
   * Identifies the current contents of a collection that can be replaced
   * wholesale (for example a recording that was cleared). A cursor issued
   * for a different generation answers `reset: true`.
   */
  generation?: string | number;
};

const INVALID_LIMIT_MESSAGE = `"limit" must be an integer between 1 and ${MAX_PAGE_LIMIT}`;
const INVALID_CURSOR_MESSAGE =
  'Invalid "cursor". Run the command again without cursor to restart pagination.';
const SCOPE_MISMATCH_MESSAGE =
  'Cursor does not match this listing. Run the command again without cursor.';

/**
 * Normalises a raw `limit` tool argument with the same rules the CLI applies
 * to `--limit`: absent means {@link DEFAULT_PAGE_LIMIT}, values above
 * {@link MAX_PAGE_LIMIT} are capped, anything that is not a positive integer
 * throws.
 */
export const normalizePageLimit = (value: unknown): number => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PAGE_LIMIT;
  }

  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(INVALID_LIMIT_MESSAGE);
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
};

// --- UTF-8 -----------------------------------------------------------------

const utf8Encode = (text: string): number[] => {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    let codePoint = text.charCodeAt(index);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      }
    }
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      // Lone surrogate: not encodable, substitute U+FFFD like TextEncoder does.
      codePoint = 0xfffd;
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
};

/** Strict UTF-8 decoder; returns `undefined` for malformed input. */
const utf8Decode = (bytes: readonly number[]): string | undefined => {
  let text = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    let codePoint: number;
    let length: number;
    let min: number;

    if (first < 0x80) {
      codePoint = first;
      length = 1;
      min = 0;
    } else if ((first & 0xe0) === 0xc0) {
      codePoint = first & 0x1f;
      length = 2;
      min = 0x80;
    } else if ((first & 0xf0) === 0xe0) {
      codePoint = first & 0x0f;
      length = 3;
      min = 0x800;
    } else if ((first & 0xf8) === 0xf0) {
      codePoint = first & 0x07;
      length = 4;
      min = 0x10000;
    } else {
      return undefined;
    }

    if (index + length > bytes.length) {
      return undefined;
    }
    for (let offset = 1; offset < length; offset += 1) {
      const next = bytes[index + offset];
      if ((next & 0xc0) !== 0x80) {
        return undefined;
      }
      codePoint = (codePoint << 6) | (next & 0x3f);
    }
    if (codePoint < min || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return undefined;
    }

    text += String.fromCodePoint(codePoint);
    index += length;
  }
  return text;
};

// --- base64url ---------------------------------------------------------------

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BASE64URL_LOOKUP: Record<string, number> = Object.fromEntries(
  Array.from(BASE64URL_ALPHABET, (char, index) => [char, index]),
);

const base64UrlEncode = (bytes: readonly number[]): string => {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index;
    const chunk =
      (bytes[index] << 16) |
      ((remaining > 1 ? bytes[index + 1] : 0) << 8) |
      (remaining > 2 ? bytes[index + 2] : 0);

    output += BASE64URL_ALPHABET[(chunk >> 18) & 0x3f];
    output += BASE64URL_ALPHABET[(chunk >> 12) & 0x3f];
    if (remaining > 1) {
      output += BASE64URL_ALPHABET[(chunk >> 6) & 0x3f];
    }
    if (remaining > 2) {
      output += BASE64URL_ALPHABET[chunk & 0x3f];
    }
  }
  return output;
};

/** Unpadded base64url decoder; returns `undefined` for malformed input. */
const base64UrlDecode = (text: string): number[] | undefined => {
  if (text.length % 4 === 1) {
    return undefined;
  }

  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const group = text.slice(index, index + 4);
    let chunk = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      const char = group[offset];
      let value = 0;
      if (char !== undefined) {
        const lookedUp = BASE64URL_LOOKUP[char];
        if (lookedUp === undefined) {
          return undefined;
        }
        value = lookedUp;
      }
      chunk = (chunk << 6) | value;
    }

    bytes.push((chunk >> 16) & 0xff);
    if (group.length > 2) {
      bytes.push((chunk >> 8) & 0xff);
    }
    if (group.length > 3) {
      bytes.push(chunk & 0xff);
    }
  }
  return bytes;
};

// --- cursors -----------------------------------------------------------------

/**
 * Encodes a JSON-serialisable value as an opaque, URL- and shell-safe
 * cursor string (unpadded base64url of its UTF-8 JSON).
 */
export const encodeCursor = (payload: unknown): string => {
  const json = JSON.stringify(payload);
  if (json === undefined) {
    throw new Error('Cursor payload must be JSON-serialisable');
  }
  return base64UrlEncode(utf8Encode(json));
};

/**
 * Decodes a cursor produced by {@link encodeCursor}. Throws the standard
 * invalid-cursor error for anything that is not one.
 */
export const decodeCursor = (raw: unknown): unknown => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  const bytes = base64UrlDecode(raw);
  const json = bytes ? utf8Decode(bytes) : undefined;
  if (json === undefined) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }
};

const isCursorKey = (value: unknown): value is CursorKey =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

const parseCursorPayload = (raw: unknown): CursorPayload => {
  const decoded = decodeCursor(raw);
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  const payload = decoded as Record<string, unknown>;
  if (
    !isCursorKey(payload.k) ||
    (payload.s !== undefined && typeof payload.s !== 'string') ||
    (payload.g !== undefined && !isCursorKey(payload.g))
  ) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  return payload as CursorPayload;
};

/**
 * Returns one page of `rows`, resuming after the row a previous page's
 * `nextCursor` pointed at.
 *
 * - No cursor: the first `limit` rows.
 * - A cursor that cannot be decoded: throws.
 * - A cursor issued for a different `scope`: throws.
 * - A cursor issued for a different `generation`, or whose row is no longer
 *   in `rows`: `{ items: [], page: { limit, hasMore: false, reset: true } }`.
 */
export const paginateArray = <TItem>(
  rows: readonly TItem[],
  options: PaginateArrayOptions<TItem>,
): PageResult<TItem> => {
  const { keyOf, scope, generation } = options;
  const limit = normalizePageLimit(options.limit);

  let start = 0;
  if (options.cursor !== undefined && options.cursor !== null && options.cursor !== '') {
    const payload = parseCursorPayload(options.cursor);

    if (payload.s !== undefined && scope !== undefined && payload.s !== scope) {
      throw new Error(SCOPE_MISMATCH_MESSAGE);
    }

    const anchor =
      payload.g === generation ? rows.findIndex((row) => keyOf(row) === payload.k) : -1;
    if (anchor === -1) {
      return { items: [], page: { limit, hasMore: false, reset: true } };
    }
    start = anchor + 1;
  }

  const items = rows.slice(start, start + limit);
  const hasMore = start + items.length < rows.length;
  if (!hasMore || items.length === 0) {
    return { items, page: { limit, hasMore: false } };
  }

  const next: CursorPayload = { k: keyOf(items[items.length - 1]) };
  if (scope !== undefined) {
    next.s = scope;
  }
  if (generation !== undefined) {
    next.g = generation;
  }

  return { items, page: { limit, hasMore: true, nextCursor: encodeCursor(next) } };
};
