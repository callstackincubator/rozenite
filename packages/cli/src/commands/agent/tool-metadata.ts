/**
 * Reads the list metadata a tool declares (ADR 0004, decisions 4 and 5).
 *
 * `pagination.itemsKey`, `pagination.meta` and `rows` are read structurally
 * here rather than through `@rozenite/agent-shared` types, so a CLI built
 * against an older `agent-shared` still understands a newer tool, and
 * malformed metadata from a third-party plugin degrades to unshaped output
 * with a warning instead of failing the call.
 */
import { isAgentToolPagination, type AgentToolPagination } from '@rozenite/agent-shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isUniqueStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString) && new Set(value).size === value.length;

export type ToolFieldSet = {
  fields: readonly string[];
  defaultFields?: readonly string[];
};

export type PaginationMetadata = AgentToolPagination & {
  itemsKey?: string;
  meta?: readonly string[];
};

export type RowsMetadata = ToolFieldSet & {
  key?: string;
};

export type ToolListMetadata = {
  pagination?: PaginationMetadata;
  rows?: RowsMetadata;
  warning?: string;
};

const hasValidFieldSet = (value: Record<string, unknown>): boolean =>
  isAgentToolPagination({
    kind: 'cursor',
    fields: value.fields,
    defaultFields: value.defaultFields,
  });

/** `pagination` with its optional `itemsKey` and `meta`, or `undefined` when malformed. */
export const getPaginationMetadata = (value: unknown): PaginationMetadata | undefined => {
  if (!isRecord(value) || !isAgentToolPagination(value)) {
    return undefined;
  }
  if (value.itemsKey !== undefined && !isNonEmptyString(value.itemsKey)) {
    return undefined;
  }
  if (value.meta !== undefined && !isUniqueStringList(value.meta)) {
    return undefined;
  }
  return value as PaginationMetadata;
};

/** `rows`, or `undefined` when malformed. */
export const getRowsMetadata = (value: unknown): RowsMetadata | undefined => {
  if (!isRecord(value) || !hasValidFieldSet(value)) {
    return undefined;
  }
  if (value.key !== undefined && !isNonEmptyString(value.key)) {
    return undefined;
  }
  return value as RowsMetadata;
};

/**
 * The list metadata of a resolved tool schema. A tool that declares
 * `pagination` is a paged list; one that declares only `rows` is an
 * unpaged list; anything else prints as the tool returned it.
 */
export const getToolListMetadata = (schema: unknown): ToolListMetadata => {
  if (!isRecord(schema)) {
    return {};
  }

  if (schema.pagination !== undefined) {
    const pagination = getPaginationMetadata(schema.pagination);
    return pagination
      ? { pagination }
      : {
          warning:
            'Warning: tool exposes invalid pagination metadata; returning its result unshaped.',
        };
  }

  if (schema.rows !== undefined) {
    const rows = getRowsMetadata(schema.rows);
    return rows
      ? { rows }
      : { warning: 'Warning: tool exposes invalid rows metadata; returning its result unshaped.' };
  }

  return {};
};
