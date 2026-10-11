/**
 * Canonical tool names of the built-in agent domains. Everything that needs
 * to name one of these tools (the middleware services, the SDK's static
 * domain table, capability profiles) derives from here so they cannot drift.
 */
export const CONSOLE_TOOL_NAMES = {
  clearMessages: 'clearMessages',
  getMessages: 'getMessages',
} as const;

export const REACT_TOOL_NAMES = {
  getTree: 'getTree',
  searchNodes: 'searchNodes',
  getComponent: 'getComponent',
  getNode: 'getNode',
  getChildren: 'getChildren',
  getProps: 'getProps',
  getState: 'getState',
  getHooks: 'getHooks',
  getErrors: 'getErrors',
  startProfiling: 'startProfiling',
  isProfilingStarted: 'isProfilingStarted',
  stopProfiling: 'stopProfiling',
  getComponentRenders: 'getComponentRenders',
  getProfileTimeline: 'getProfileTimeline',
  getRenderData: 'getRenderData',
} as const;

export const PERFORMANCE_TOOL_NAMES = {
  startTrace: 'startTrace',
  stopTrace: 'stopTrace',
} as const;

export const MEMORY_TOOL_NAMES = {
  takeHeapSnapshot: 'takeHeapSnapshot',
  startSampling: 'startSampling',
  stopSampling: 'stopSampling',
} as const;

export const NETWORK_TOOL_NAMES = {
  startRecording: 'startRecording',
  stopRecording: 'stopRecording',
  getRecordingStatus: 'getRecordingStatus',
  listRequests: 'listRequests',
  getRequestDetails: 'getRequestDetails',
  getRequestBody: 'getRequestBody',
  getResponseBody: 'getResponseBody',
} as const;

const names = <T extends Record<string, string>>(map: T): readonly T[keyof T][] =>
  Object.freeze(Object.values(map) as T[keyof T][]);

/** Tool names per built-in domain id, in declaration order. Frozen. */
export const BUILT_IN_DOMAIN_TOOL_NAMES = {
  console: names(CONSOLE_TOOL_NAMES),
  react: names(REACT_TOOL_NAMES),
  performance: names(PERFORMANCE_TOOL_NAMES),
  memory: names(MEMORY_TOOL_NAMES),
  network: names(NETWORK_TOOL_NAMES),
} as const satisfies Record<string, readonly string[]>;
