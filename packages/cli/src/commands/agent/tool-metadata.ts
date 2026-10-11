/**
 * Reads the list metadata a tool declares (ADR 0004, decisions 4 and 5):
 * `pagination` (with its optional `itemsKey` and `meta`) or `rows`.
 *
 * Malformed metadata from a third-party plugin degrades to unshaped output
 * with a warning instead of failing the call.
 */
import {
  isAgentToolPagination,
  isAgentToolRows,
  type AgentToolPagination,
  type AgentToolRows,
} from '@rozenite/agent-shared';

export type ToolFieldSet = {
  fields: readonly string[];
  defaultFields?: readonly string[];
};

export type ToolListMetadata = {
  pagination?: AgentToolPagination;
  rows?: AgentToolRows;
  warning?: string;
};

/**
 * The list metadata of a resolved tool schema. A tool that declares
 * `pagination` is a paged list; one that declares only `rows` is an unpaged
 * list; anything else prints as the tool returned it.
 */
export const getToolListMetadata = (schema: {
  pagination?: unknown;
  rows?: unknown;
}): ToolListMetadata => {
  if (schema.pagination !== undefined) {
    return isAgentToolPagination(schema.pagination)
      ? { pagination: schema.pagination }
      : {
          warning:
            'Warning: tool exposes invalid pagination metadata; returning its result unshaped.',
        };
  }

  if (schema.rows !== undefined) {
    return isAgentToolRows(schema.rows)
      ? { rows: schema.rows }
      : { warning: 'Warning: tool exposes invalid rows metadata; returning its result unshaped.' };
  }

  return {};
};
