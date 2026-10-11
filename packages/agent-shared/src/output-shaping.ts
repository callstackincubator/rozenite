/**
 * Frontend-neutral shaping primitives for paginated Agent tool results.
 *
 * These primitives turn a `{ items, page }` envelope into the compact
 * columnar/row-keyed wire shape shared by every Agent frontend (CLI today,
 * MCP and anything built on `@rozenite/agent-sdk` later). They are
 * transport-agnostic: they know nothing about shells, HTTP, or any other
 * frontend surface.
 *
 * Notably absent: a next-page *affordance*. Each frontend renders its own —
 * the CLI renders a copy-pasteable `npx rozenite agent ...` command, MCP
 * would render a `page` argument for its call-tool schema — so these
 * functions accept the already-rendered affordance as a plain string (or
 * `undefined`) rather than building one themselves. See
 * {@link shapePaginatedRows} and {@link shapeToolResult}.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * The `--fields` value that selects every declared field. A listing that
 * declares a field literally named `all` keeps that field reachable: the
 * token then means the field, not the whole set.
 */
export const ALL_FIELDS = 'all';

/**
 * Whether a raw `--fields` value selects every declared field rather than
 * naming specific ones.
 */
export const isAllFields = (
  rawFields: string | undefined,
  allowedFields: readonly string[],
): boolean => rawFields?.trim() === ALL_FIELDS && !allowedFields.includes(ALL_FIELDS);

export const parseFields = <T extends string>(
  rawFields: string | undefined,
  allowedFields: readonly T[],
  defaultFields: readonly T[],
  verbose: boolean,
): T[] => {
  if (verbose || isAllFields(rawFields, allowedFields)) {
    return [...allowedFields];
  }

  if (!rawFields || rawFields.trim().length === 0) {
    return [...defaultFields];
  }

  const requested = rawFields
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean) as T[];

  if (requested.length === 0) {
    return [...defaultFields];
  }

  const allowedSet = new Set(allowedFields);
  const invalid = requested.filter((field) => !allowedSet.has(field));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown fields: ${invalid.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
    );
  }

  return requested;
};

export const parseLimit = (rawLimit: string | undefined): number => {
  if (!rawLimit) {
    return DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
};

/**
 * Projects rows onto the selected fields for columnar encoding, where each
 * row becomes a fixed-width array positionally aligned with `cols`. Absent
 * values become an explicit `null` placeholder because a missing array slot
 * would shift every column after it.
 */
export const projectRows = <T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
): Record<string, unknown>[] => {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      projected[field] = row[field] ?? null;
    }
    return projected;
  });
};

/**
 * Projects rows onto the selected fields for row-keyed encoding, where each
 * row stays an object. Unlike {@link projectRows}, absent fields are omitted
 * rather than nulled: row-keyed output exists specifically for the 0/1-row
 * case (see {@link shapePaginatedRows}), where explicit nulls would make the
 * payload larger than the pre-columnar shape and defeat the point of
 * staying expanded.
 */
const projectRowKeyed = <T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
): Record<string, unknown>[] => {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (Object.hasOwn(row, field)) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
};

type PaginatedRows<T> = {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type ShapeRowsOptions = {
  /**
   * Key the rows are printed under while they stay expanded (zero or one
   * row). Defaults to `items`. A tool that declares `pagination.itemsKey`
   * or `rows.key` keeps its own key, so the printed shape still says what
   * the rows are.
   */
  rowsKey?: string;
  /**
   * Drop a column whose value is `null` (or absent) on every row of the
   * page (ADR 0004, decision 8). A frontend enables this for its default
   * projection only: a column the caller named explicitly is always
   * printed. `cols` is part of every columnar page, so the output stays
   * self-describing when a column is dropped.
   */
  elideNullColumns?: boolean;
};

const isNullish = (value: unknown): boolean => value === null || value === undefined;

/**
 * Removes the fields that are null or absent on every row. Returns the
 * input when nothing is elided, so the caller's field order is kept.
 */
export const elideNullColumns = (
  rows: readonly Record<string, unknown>[],
  fields: readonly string[],
): string[] => fields.filter((field) => rows.some((row) => !isNullish(row[field])));

/**
 * Shapes a paginated row listing for Agent consumption.
 *
 * The selected fields, rather than fields observed in individual rows, define
 * `cols`. This keeps the wire shape stable when optional values are absent.
 * Zero- and one-row listings remain expanded because a column header costs
 * more than the repeated keys it removes.
 *
 * The two branches project rows differently on purpose, via separate
 * helpers rather than a shared one with a flag: the row-keyed (`items`)
 * branch uses {@link projectRowKeyed}, which omits absent fields, so it
 * never grows past the pre-columnar row-keyed shape — the entire reason
 * 0/1-row listings stay expanded instead of going columnar. The columnar
 * (`cols`/`rows`) branch uses {@link projectRows}, which fills absent
 * fields with `null`, because positional array cells must line up with
 * `cols` and can't simply be omitted.
 *
 * `nextAffordance` is the already-rendered next-page affordance for whatever
 * frontend is calling this (a shell command for the CLI, a `page` argument
 * description for MCP, etc.) — this function only decides *whether* to
 * surface it (`page.hasMore` and a value present), never how to build it.
 */
export const shapePaginatedRows = (
  paged: PaginatedRows<Record<string, unknown>>,
  fields: readonly string[],
  nextAffordance: string | undefined,
  options: ShapeRowsOptions = {},
): Record<string, unknown> => {
  const next = paged.page.hasMore && nextAffordance ? { next: nextAffordance } : {};
  const selected = options.elideNullColumns ? elideNullColumns(paged.items, fields) : fields;

  if (paged.items.length < 2) {
    return {
      [options.rowsKey ?? 'items']: projectRowKeyed(paged.items, selected),
      ...next,
    };
  }

  const items = projectRows(paged.items, selected);
  return {
    cols: [...selected],
    rows: items.map((row) => selected.map((field) => row[field])),
    ...next,
  };
};

/** Top-level keys `shapeToolResult` itself introduces into its output. */
const SHAPED_OUTPUT_KEYS = ['cols', 'rows', 'next'] as const;

export type ShapeToolResultOptions = {
  /**
   * `false` shapes a tool that returns a list without paging it and
   * declares `rows` instead of `pagination` (ADR 0004, decision 5): no
   * `page` is expected and `meta` does not apply. See
   * {@link shapeRowsResult}. Defaults to `true`.
   */
  paged?: boolean;
  /**
   * Result key holding the rows: `pagination.itemsKey`, or `rows.key` when
   * `paged` is `false`. Defaults to `items`.
   */
  itemsKey?: string;
  /**
   * Top-level keys, besides the rows and `page`, to print with a page
   * (`pagination.meta`). `undefined` prints every key, which is how a tool
   * that declares nothing has always printed; `[]` prints none.
   */
  meta?: readonly string[];
  /** See {@link ShapeRowsOptions.elideNullColumns}. */
  elideNullColumns?: boolean;
};

const pickMetadata = (
  metadata: Record<string, unknown>,
  meta: readonly string[] | undefined,
): Record<string, unknown> => {
  if (!meta) {
    return metadata;
  }

  return Object.fromEntries(
    meta.filter((key) => Object.hasOwn(metadata, key)).map((key) => [key, metadata[key]]),
  );
};

/**
 * Applies the shared presentation contract to a known tool's paginated
 * result while retaining any non-row metadata owned by that tool.
 *
 * `metadata` (every top-level key besides the rows and `page`, narrowed to
 * `options.meta` when the tool declares it) is spread ahead of the shaped
 * output, so a tool whose own metadata uses one of the keys this function
 * produces (`cols`, `rows`, `next`) would otherwise have it silently
 * overwritten. Rather than let that happen invisibly, such a collision
 * degrades the whole result to unshaped — the same "degrade rather than
 * corrupt" rule this function already applies to malformed pagination
 * envelopes.
 *
 * `nextAffordance` is the frontend's already-rendered next-page affordance,
 * same as in {@link shapePaginatedRows}. This function stays frontend-
 * agnostic: it decides only whether a continuation should be surfaced, and
 * leaves rendering that continuation entirely to the caller.
 */
export const shapeToolResult = (
  result: unknown,
  fields: readonly string[],
  nextAffordance: string | undefined,
  options: ShapeToolResultOptions = {},
): unknown => {
  if (options.paged === false) {
    return shapeRowsResult(result, fields, {
      key: options.itemsKey,
      elideNullColumns: options.elideNullColumns,
    });
  }

  const itemsKey = options.itemsKey ?? 'items';
  if (!isRecord(result) || !Array.isArray(result[itemsKey]) || !isRecord(result.page)) {
    return result;
  }

  const {
    [itemsKey]: rawItems,
    page,
    ...allMetadata
  } = result as Record<string, unknown> & {
    page: Record<string, unknown>;
  };
  const items = rawItems as unknown[];
  if (
    !items.every(isRecord) ||
    typeof page.limit !== 'number' ||
    !Number.isFinite(page.limit) ||
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    typeof page.hasMore !== 'boolean' ||
    (page.nextCursor !== undefined && typeof page.nextCursor !== 'string') ||
    (page.reset !== undefined && typeof page.reset !== 'boolean')
  ) {
    return result;
  }
  if (page.hasMore && !nextAffordance) {
    return result;
  }

  const metadata = pickMetadata(allMetadata, options.meta);
  if (
    SHAPED_OUTPUT_KEYS.some((key) => Object.hasOwn(metadata, key)) ||
    Object.hasOwn(metadata, itemsKey)
  ) {
    return result;
  }

  return {
    ...metadata,
    ...(page.reset === true ? { page: { reset: true } } : {}),
    ...shapePaginatedRows(
      {
        items: items as Record<string, unknown>[],
        page: {
          limit: page.limit,
          hasMore: page.hasMore,
          ...(typeof page.nextCursor === 'string' ? { nextCursor: page.nextCursor } : {}),
        },
      },
      fields,
      nextAffordance,
      { rowsKey: itemsKey, elideNullColumns: options.elideNullColumns },
    ),
  };
};

export type ShapeRowsResultOptions = {
  /** Result key holding the rows (`rows.key`). Defaults to `items`. */
  key?: string;
  /** See {@link ShapeRowsOptions.elideNullColumns}. */
  elideNullColumns?: boolean;
};

/**
 * Shapes the result of a tool that returns a list without paging it and
 * declares its rows (ADR 0004, decision 5): the rows under `options.key`
 * are projected onto `fields` and encoded as columns at two or more rows,
 * exactly like a page. Every other key is printed as the tool returned it.
 *
 * Anything that does not hold an array of objects under the declared key,
 * or whose other keys collide with `cols`/`rows`, is returned unchanged.
 */
export const shapeRowsResult = (
  result: unknown,
  fields: readonly string[],
  options: ShapeRowsResultOptions = {},
): unknown => {
  const key = options.key ?? 'items';
  if (!isRecord(result) || !Array.isArray(result[key])) {
    return result;
  }

  const { [key]: rawRows, ...metadata } = result;
  const rows = rawRows as unknown[];
  if (!rows.every(isRecord) || SHAPED_OUTPUT_KEYS.some((name) => Object.hasOwn(metadata, name))) {
    return result;
  }

  return {
    ...metadata,
    ...shapePaginatedRows(
      {
        items: rows as Record<string, unknown>[],
        page: { limit: rows.length || 1, hasMore: false },
      },
      fields,
      undefined,
      { rowsKey: key, elideNullColumns: options.elideNullColumns },
    ),
  };
};
