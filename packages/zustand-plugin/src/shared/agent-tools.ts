import {
  defineAgentToolContract,
  definePaginatedAgentToolContract,
  defineRowsAgentToolContract,
  type BoundedValueArgs,
  type PageEnvelope,
} from '@rozenite/agent-shared';
import type { TransitionSource } from './protocol';
import type { StatePatch } from './patch';

export const ZUSTAND_AGENT_PLUGIN_ID = '@rozenite/zustand-plugin';

export type ZustandAgentStoreInput = {
  /** Store id as listed by `list-stores`. Optional when only one store is registered. */
  storeId?: string;
};

export type ZustandAgentStoreSummary = {
  storeId: string;
  name: string;
  transitionCount: number;
  latestSeq: number;
  recording: boolean;
  persisted: boolean;
  actions: string[];
};

export type ZustandAgentTransitionSummary = {
  seq: number;
  timestamp: number;
  action: string;
  source: TransitionSource;
  changedPaths: string[];
  durationMs?: number;
};

export type ZustandAgentListStoresResult = { stores: ZustandAgentStoreSummary[] };

export type ZustandAgentGetStateArgs = ZustandAgentStoreInput & BoundedValueArgs;
export type ZustandAgentGetStateResult = {
  store: ZustandAgentStoreSummary;
  state: unknown;
  path?: string;
  truncated: boolean;
};

export type ZustandAgentListTransitionsArgs = ZustandAgentStoreInput & {
  limit?: number;
  cursor?: string;
};
export type ZustandAgentListTransitionsResult = {
  store: ZustandAgentStoreSummary;
  items: ZustandAgentTransitionSummary[];
  page: PageEnvelope;
};

export type ZustandAgentGetTransitionArgs = ZustandAgentStoreInput & { seq: number };
export type ZustandAgentGetTransitionResult = {
  transition: ZustandAgentTransitionSummary;
  args?: unknown[];
  patches: StatePatch[];
  /** Whether args or patches were cut to the default bounds. */
  truncated: boolean;
};

export type ZustandAgentInvokeActionArgs = ZustandAgentStoreInput & {
  action: string;
  args?: unknown[];
};
export type ZustandAgentInvokeActionResult = { invoked: string; result: unknown };

export type ZustandAgentSetValueArgs = ZustandAgentStoreInput & { path: string; value: unknown };
export type ZustandAgentJumpArgs = ZustandAgentStoreInput & { seq: number };
export type ZustandAgentApplyResult = { store: ZustandAgentStoreSummary; applied: true };
export type ZustandAgentSetFlagArgs = ZustandAgentStoreInput & { value: boolean };

const storeIdProperty = {
  storeId: {
    type: 'string',
    description: 'Store id from list-stores. Optional when only one store is registered.',
  },
} as const;

const boundedValueProperties = {
  path: {
    type: 'string',
    description:
      'Dot path to read a sub-tree, e.g. "cart.items.0". Paths follow the state, not get-state\'s tags (no "v" segment): Set items by index, Map entries as "<index>.1" (value) or "<index>.0" (key).',
  },
  maxDepth: { type: 'integer', description: 'Levels expanded below the value. Defaults to 4.' },
  maxValueLength: { type: 'integer', description: 'Longest string returned. Defaults to 512.' },
  maxItems: { type: 'integer', description: 'Most items or keys per level. Defaults to 100.' },
} as const;

export const zustandAgentToolDefinitions = {
  listStores: defineRowsAgentToolContract<undefined, ZustandAgentListStoresResult, 'stores'>({
    name: 'list-stores',
    description:
      'List the Zustand stores registered with the Rozenite Zustand plugin, with their recorded history size and callable actions.',
    inputSchema: { type: 'object', properties: {} },
    rows: {
      key: 'stores',
      fields: [
        'storeId',
        'name',
        'transitionCount',
        'latestSeq',
        'recording',
        'persisted',
        'actions',
      ],
    },
  }),
  getState: defineAgentToolContract<ZustandAgentGetStateArgs, ZustandAgentGetStateResult>({
    name: 'get-state',
    description:
      'Return the current state of a store, cut to maxDepth/maxValueLength/maxItems. Use path to read a deeper sub-tree. Values JSON cannot hold are tagged objects: { "$t": "fn" } for actions, "map" / "set" / "class" with their contents under "v", "date", "undef" and so on. Values over budget are cut (truncated: true).',
    inputSchema: { type: 'object', properties: { ...storeIdProperty, ...boundedValueProperties } },
  }),
  listTransitions: definePaginatedAgentToolContract<
    ZustandAgentListTransitionsArgs,
    ZustandAgentListTransitionsResult,
    'items'
  >({
    name: 'list-transitions',
    description:
      'List recorded state transitions of a store, newest first: action name, how it was attributed (action, async, named, external, hydrate, edit…) and which paths changed.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        limit: { type: 'integer', description: 'Page size. Defaults to 20, max 100.' },
        cursor: { type: 'string', description: 'Opaque cursor from a previous page.' },
      },
    },
    pagination: {
      kind: 'cursor',
      fields: ['seq', 'timestamp', 'action', 'source', 'changedPaths', 'durationMs'],
      defaultFields: ['seq', 'action', 'source', 'changedPaths'],
    },
  }),
  getTransition: defineAgentToolContract<
    ZustandAgentGetTransitionArgs,
    ZustandAgentGetTransitionResult
  >({
    name: 'get-transition',
    description:
      'Return one transition: its action arguments and the exact patches (old and new values), cut to the default bounds.',
    inputSchema: {
      type: 'object',
      properties: { ...storeIdProperty, seq: { type: 'integer', description: 'Transition seq.' } },
      required: ['seq'],
    },
  }),
  invokeAction: defineAgentToolContract<
    ZustandAgentInvokeActionArgs,
    ZustandAgentInvokeActionResult
  >({
    name: 'invoke-action',
    description:
      'Call one of the store\'s action functions (e.g. "addItem" or "cart.add") with JSON arguments, exactly as app code would.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        action: { type: 'string', description: 'Action path from list-stores.' },
        args: {
          type: 'array',
          description:
            'JSON arguments. Tagged values as get-state shows them (e.g. a date) are decoded.',
        },
      },
      required: ['action'],
    },
  }),
  setValue: defineAgentToolContract<ZustandAgentSetValueArgs, ZustandAgentApplyResult>({
    name: 'set-value',
    description:
      'Set the value at a dot path in the store state (writes through to persisted storage).',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        path: {
          type: 'string',
          description:
            'Dot path as get-state takes it, e.g. "settings.theme". Every segment but the last must exist.',
        },
        value: { description: 'New JSON value.' },
      },
      required: ['path', 'value'],
    },
  }),
  jumpToTransition: defineAgentToolContract<ZustandAgentJumpArgs, ZustandAgentApplyResult>({
    name: 'jump-to-transition',
    description:
      'Time travel: restore the state recorded right after a transition, or the state before the oldest one held. Actions are kept, and persist() writes the restored state to storage.',
    inputSchema: {
      type: 'object',
      properties: { ...storeIdProperty, seq: { type: 'integer', description: 'Transition seq.' } },
      required: ['seq'],
    },
  }),
  setRecording: defineAgentToolContract<ZustandAgentSetFlagArgs, ZustandAgentApplyResult>({
    name: 'set-recording',
    description: 'Pause (false) or resume (true) recording transitions for a store.',
    inputSchema: {
      type: 'object',
      properties: { ...storeIdProperty, value: { type: 'boolean' } },
      required: ['value'],
    },
  }),
};
