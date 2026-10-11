import {
  defineAgentToolContract,
  definePaginatedAgentToolContract,
  defineRowsAgentToolContract,
  type AgentToolContract,
  type PageEnvelope,
} from '@rozenite/agent-shared';
import type { ReduxActionTrace } from './trace';
import type { BoundedValueArgs } from './bounded-value';

export const REDUX_DEVTOOLS_AGENT_PLUGIN_ID = '@rozenite/redux-devtools-plugin';

export type ReduxDevToolsStoreInput = {
  instanceId?: string;
};

export type ReduxDevToolsPaginatedStoreInput = ReduxDevToolsStoreInput & {
  /** Page size. Defaults to 20, max 100. */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
  /** @deprecated Use `cursor`. Index the first page starts at. */
  offset?: number;
};

export type ReduxDevToolsActionInput = ReduxDevToolsStoreInput & {
  actionId: number;
};

export type ReduxDevToolsDispatchActionInput = ReduxDevToolsStoreInput & {
  action: unknown;
};

export type ReduxDevToolsSetRecordingPausedInput = ReduxDevToolsStoreInput & {
  paused: boolean;
};

export type ReduxDevToolsSetLockedInput = ReduxDevToolsStoreInput & {
  locked: boolean;
};

export type ReduxDevToolsStoreSummary = {
  instanceId: string;
  name: string;
  maxAge: number;
  actionCount: number;
  currentStateIndex: number;
  isLocked: boolean;
  isPaused: boolean;
};

export type ReduxDevToolsActionSummary = {
  instanceId: string;
  actionId: number;
  type: string;
  liftedType: string | null;
  timestamp: number | null;
  isCurrent: boolean;
  isSkipped: boolean;
  hasError: boolean;
};

export type ReduxDevToolsListStoresArgs = undefined;

export type ReduxDevToolsListStoresResult = {
  stores: ReduxDevToolsStoreSummary[];
};

export type ReduxDevToolsBoundedValueArgs = BoundedValueArgs;

export type ReduxDevToolsGetStoreStateArgs = ReduxDevToolsStoreInput & BoundedValueArgs;

export type ReduxDevToolsGetStoreStateResult = {
  store: ReduxDevToolsStoreSummary;
  currentActionId: number | null;
  currentAction: ReduxDevToolsActionSummary | null;
  /** The store state (or the sub-tree at `path`), cut to `maxDepth` / `maxValueLength`. */
  state: unknown;
  /** The `path` the state was narrowed to, when one was given. */
  path?: string;
  /** Whether any value in `state` was cut. */
  truncated: boolean;
};

export type ReduxDevToolsListActionsArgs = ReduxDevToolsPaginatedStoreInput;

export type ReduxDevToolsListActionsResult = {
  store: ReduxDevToolsStoreSummary;
  total: number;
  /** Index of the first returned action in the newest-first history. */
  offset: number;
  limit: number;
  items: ReduxDevToolsActionSummary[];
  page: PageEnvelope;
};

export type ReduxDevToolsGetActionDetailsInclude = 'state';

export type ReduxDevToolsGetActionDetailsArgs = ReduxDevToolsActionInput &
  BoundedValueArgs & {
    /** Opt-in parts of the result. `state` adds the state computed after the action. */
    include?: ReduxDevToolsGetActionDetailsInclude[];
  };

export type ReduxDevToolsGetActionDetailsResult = {
  store: ReduxDevToolsStoreSummary;
  action: ReduxDevToolsActionSummary;
  liftedAction: unknown;
  /** Present only with `include: ["state"]` or a `path` starting with `state`. */
  state?: unknown;
  error: unknown;
  trace: ReduxActionTrace | null;
  /** The `path` a value was narrowed to, when one was given. */
  path?: string;
  /** Whether any value in `liftedAction` or `state` was cut. */
  truncated: boolean;
};

export type ReduxDevToolsDispatchActionArgs = ReduxDevToolsDispatchActionInput;

export type ReduxDevToolsDispatchActionResult = {
  store: ReduxDevToolsStoreSummary;
  dispatched: true;
  actionType: string;
};

export type ReduxDevToolsApplyStoreActionResult = {
  store: ReduxDevToolsStoreSummary;
  applied: true;
};

const storeIdProperty = {
  instanceId: {
    type: 'string',
    description: 'Redux DevTools instance ID. Optional when only one store is registered.',
  },
} as const;

const boundedValueProperties = {
  maxDepth: {
    type: 'integer',
    description:
      'Levels of nesting expanded below the returned value. Deeper objects and arrays collapse to "[object(N keys)]" / "[array(N)]". Defaults to 4, max 64.',
  },
  maxValueLength: {
    type: 'integer',
    description:
      'Truncate string values longer than this, marking the cut with "[+N chars]". Defaults to 512.',
  },
} as const;

export const reduxDevToolsToolDefinitions = {
  listStores: defineRowsAgentToolContract<
    ReduxDevToolsListStoresArgs,
    ReduxDevToolsListStoresResult,
    'stores'
  >({
    name: 'list-stores',
    description: 'List all Redux DevTools store instances currently registered on the device.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    rows: {
      key: 'stores',
      fields: [
        'instanceId',
        'name',
        'maxAge',
        'actionCount',
        'currentStateIndex',
        'isLocked',
        'isPaused',
      ],
    },
  }),
  getStoreState: defineAgentToolContract<
    ReduxDevToolsGetStoreStateArgs,
    ReduxDevToolsGetStoreStateResult
  >({
    name: 'get-store-state',
    description:
      'Return the current Redux store state together with lifted Redux DevTools metadata. The state is cut to maxDepth levels and maxValueLength characters per string; use path to read a deeper sub-tree.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        path: {
          type: 'string',
          description:
            'Dot path into the store state selecting the sub-tree to return, for example "todos.items.0".',
        },
        ...boundedValueProperties,
      },
    },
  }),
  listActions: definePaginatedAgentToolContract<
    ReduxDevToolsListActionsArgs,
    ReduxDevToolsListActionsResult
  >({
    name: 'list-actions',
    description:
      'List Redux action history for a store in newest-first order using cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 20, max 100.',
        },
        cursor: {
          type: 'string',
          description:
            'Opaque cursor from a previous list-actions page; the next page starts after the last action returned.',
        },
        offset: {
          type: 'number',
          description:
            '@deprecated Use cursor. Index the first page starts at; cannot be combined with cursor.',
        },
      },
    },
    pagination: {
      kind: 'cursor',
      fields: [
        'actionId',
        'type',
        'timestamp',
        'isCurrent',
        'isSkipped',
        'hasError',
        'liftedType',
        'instanceId',
      ],
      defaultFields: ['actionId', 'type', 'timestamp', 'isCurrent'],
      meta: ['total'],
    },
  }),
  getActionDetails: defineAgentToolContract<
    ReduxDevToolsGetActionDetailsArgs,
    ReduxDevToolsGetActionDetailsResult
  >({
    name: 'get-action-details',
    description:
      'Return the lifted action payload and metadata for a Redux action history entry. The state computed after the action is returned only with include ["state"]. Values are cut to maxDepth levels and maxValueLength characters per string.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        actionId: {
          type: 'number',
          description: 'Redux DevTools action ID to inspect.',
        },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['state'] },
          description:
            'Opt-in parts of the result. "state" adds the state computed after the action.',
        },
        path: {
          type: 'string',
          description:
            'Dot path selecting a sub-tree, starting with "liftedAction" or "state", for example "state.todos" or "liftedAction.action.payload". A path into state implies include ["state"].',
        },
        ...boundedValueProperties,
      },
      required: ['actionId'],
    },
  }),
  dispatchAction: defineAgentToolContract<
    ReduxDevToolsDispatchActionArgs,
    ReduxDevToolsDispatchActionResult
  >({
    name: 'dispatch-action',
    description: 'Dispatch a plain serializable Redux action through the real store dispatch path.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        action: {
          type: 'object',
          description: 'Plain serializable Redux action object with a string type.',
        },
      },
      required: ['action'],
    },
  }),
  jumpToAction: defineAgentToolContract<
    ReduxDevToolsActionInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'jump-to-action',
    description: 'Jump Redux DevTools to a specific action in history.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        actionId: {
          type: 'number',
          description: 'Redux DevTools action ID to jump to.',
        },
      },
      required: ['actionId'],
    },
  }),
  toggleAction: defineAgentToolContract<
    ReduxDevToolsActionInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'toggle-action',
    description: 'Toggle whether a Redux DevTools action is skipped in history recomputation.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        actionId: {
          type: 'number',
          description: 'Redux DevTools action ID to toggle.',
        },
      },
      required: ['actionId'],
    },
  }),
  resetHistory: defineAgentToolContract<
    ReduxDevToolsStoreInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'reset-history',
    description: 'Reset Redux DevTools history for the selected store.',
    inputSchema: {
      type: 'object',
      properties: storeIdProperty,
    },
  }),
  rollbackState: defineAgentToolContract<
    ReduxDevToolsStoreInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'rollback-state',
    description:
      'Rollback Redux DevTools state for the selected store to the last committed snapshot.',
    inputSchema: {
      type: 'object',
      properties: storeIdProperty,
    },
  }),
  commitCurrentState: defineAgentToolContract<
    ReduxDevToolsStoreInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'commit-current-state',
    description:
      'Commit the current Redux DevTools state and clear prior history for the selected store.',
    inputSchema: {
      type: 'object',
      properties: storeIdProperty,
    },
  }),
  sweepSkippedActions: defineAgentToolContract<
    ReduxDevToolsStoreInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'sweep-skipped-actions',
    description: 'Remove skipped Redux DevTools actions from history for the selected store.',
    inputSchema: {
      type: 'object',
      properties: storeIdProperty,
    },
  }),
  setRecordingPaused: defineAgentToolContract<
    ReduxDevToolsSetRecordingPausedInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'set-recording-paused',
    description: 'Pause or resume Redux DevTools action recording for the selected store.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        paused: {
          type: 'boolean',
          description: 'Whether Redux DevTools recording should be paused.',
        },
      },
      required: ['paused'],
    },
  }),
  setLocked: defineAgentToolContract<
    ReduxDevToolsSetLockedInput,
    ReduxDevToolsApplyStoreActionResult
  >({
    name: 'set-locked',
    description: 'Lock or unlock Redux DevTools changes for the selected store.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        locked: {
          type: 'boolean',
          description: 'Whether Redux DevTools should lock state changes.',
        },
      },
      required: ['locked'],
    },
  }),
} as const satisfies Record<string, AgentToolContract<unknown, unknown>>;
