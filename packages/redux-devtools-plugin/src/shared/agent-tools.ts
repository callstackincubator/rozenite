import {
  defineAgentToolContract,
  type AgentToolContract,
} from '@rozenite/agent-shared';

export const REDUX_DEVTOOLS_AGENT_PLUGIN_ID =
  '@rozenite/redux-devtools-plugin';

export type ReduxDevToolsStoreInput = {
  instanceId?: string;
};

export type ReduxDevToolsPaginatedStoreInput = ReduxDevToolsStoreInput & {
  offset?: number;
  limit?: number;
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

export type ReduxDevToolsGetStoreStateArgs = ReduxDevToolsStoreInput;

export type ReduxDevToolsGetStoreStateResult = {
  store: ReduxDevToolsStoreSummary;
  currentActionId: number | null;
  currentAction: ReduxDevToolsActionSummary | null;
  state: unknown;
};

export type ReduxDevToolsListActionsArgs = ReduxDevToolsPaginatedStoreInput;

export type ReduxDevToolsListActionsResult = {
  store: ReduxDevToolsStoreSummary;
  total: number;
  offset: number;
  limit: number;
  items: ReduxDevToolsActionSummary[];
};

export type ReduxDevToolsGetActionDetailsArgs = ReduxDevToolsActionInput;

export type ReduxDevToolsGetActionDetailsResult = {
  store: ReduxDevToolsStoreSummary;
  action: ReduxDevToolsActionSummary;
  liftedAction: unknown;
  state: unknown;
  error: unknown;
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

export const reduxDevToolsToolDefinitions = {
  listStores: defineAgentToolContract<
    ReduxDevToolsListStoresArgs,
    ReduxDevToolsListStoresResult
  >({
    name: 'list-stores',
    description:
      'List all Redux DevTools store instances currently registered on the device.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  }),
  getStoreState: defineAgentToolContract<
    ReduxDevToolsGetStoreStateArgs,
    ReduxDevToolsGetStoreStateResult
  >({
    name: 'get-store-state',
    description:
      'Return the current Redux store state together with lifted Redux DevTools metadata.',
    inputSchema: {
      type: 'object',
      properties: storeIdProperty,
    },
  }),
  listActions: defineAgentToolContract<
    ReduxDevToolsListActionsArgs,
    ReduxDevToolsListActionsResult
  >({
    name: 'list-actions',
    description:
      'List Redux action history for a store in newest-first order using pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        offset: {
          type: 'number',
          description: 'Pagination offset. Defaults to 0.',
        },
        limit: {
          type: 'number',
          description: 'Pagination size. Defaults to 50.',
        },
      },
    },
  }),
  getActionDetails: defineAgentToolContract<
    ReduxDevToolsGetActionDetailsArgs,
    ReduxDevToolsGetActionDetailsResult
  >({
    name: 'get-action-details',
    description:
      'Return the lifted action payload, computed state, and metadata for a Redux action history entry.',
    inputSchema: {
      type: 'object',
      properties: {
        ...storeIdProperty,
        actionId: {
          type: 'number',
          description: 'Redux DevTools action ID to inspect.',
        },
      },
      required: ['actionId'],
    },
  }),
  dispatchAction: defineAgentToolContract<
    ReduxDevToolsDispatchActionArgs,
    ReduxDevToolsDispatchActionResult
  >({
    name: 'dispatch-action',
    description:
      'Dispatch a plain serializable Redux action through the real store dispatch path.',
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
    description:
      'Toggle whether a Redux DevTools action is skipped in history recomputation.',
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
    description:
      'Remove skipped Redux DevTools actions from history for the selected store.',
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
    description:
      'Pause or resume Redux DevTools action recording for the selected store.',
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
