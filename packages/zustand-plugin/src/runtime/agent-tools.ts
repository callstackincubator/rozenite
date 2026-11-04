import {
  boundValue,
  normalizeBoundedValueArgs,
  paginateArray,
  parseValuePath,
} from '@rozenite/agent-shared';
import {
  UNBOUNDED_BUDGET,
  encodeValue,
  isPlainObject,
  readRawPath,
  type EncodedValue,
  type StatePath,
} from '../shared/codec';
import type {
  ZustandAgentApplyResult,
  ZustandAgentGetStateArgs,
  ZustandAgentGetStateResult,
  ZustandAgentGetTransitionArgs,
  ZustandAgentGetTransitionResult,
  ZustandAgentInvokeActionArgs,
  ZustandAgentInvokeActionResult,
  ZustandAgentJumpArgs,
  ZustandAgentListStoresResult,
  ZustandAgentListTransitionsArgs,
  ZustandAgentListTransitionsResult,
  ZustandAgentSetFlagArgs,
  ZustandAgentSetValueArgs,
  ZustandAgentStoreSummary,
  ZustandAgentTransitionSummary,
} from '../shared/agent-tools';
import {
  editStoreValue,
  encodeRawTransition,
  getSanitizedState,
  getSessionId,
  getStoreAdapter,
  inspectStore,
  invokeStoreAction,
  jumpTo,
  listStoreIds,
  setRecording,
  type RawTransition,
} from './store-registry';

const resolveStoreId = (storeId?: string): string => {
  if (storeId) return storeId;
  const ids = listStoreIds();
  if (ids.length === 1) return ids[0];
  throw new Error(
    ids.length === 0
      ? 'No Zustand stores are registered.'
      : `Several stores are registered; pass storeId (one of: ${ids.join(', ')}).`,
  );
};

const summarize = (storeId: string): ZustandAgentStoreSummary => {
  const { descriptor, ring, base } = inspectStore(storeId);
  return {
    storeId,
    name: descriptor.name,
    transitionCount: ring.length,
    latestSeq: ring[ring.length - 1]?.seq ?? base.seq,
    recording: descriptor.recording,
    persisted: !!descriptor.persist,
    actions: descriptor.actions.map((action) => action.path),
  };
};

const summarizeTransition = (
  raw: RawTransition,
  encoded: ReturnType<typeof encodeRawTransition>,
): ZustandAgentTransitionSummary => {
  return {
    seq: raw.seq,
    timestamp: raw.timestamp,
    action: raw.action.name,
    source: raw.action.source,
    // The same dot paths get-state and set-value take.
    changedPaths: encoded.patches.map((patch) => patch.path.join('.') || '$'),
    durationMs: raw.durationMs,
  };
};

/**
 * Encoded (tagged) JSON is what agents read: Maps, Dates and functions stay
 * legible. Unbounded here -- the panel's lazy placeholders cannot be expanded
 * by an agent -- and cut to size by `boundValue` instead.
 */
const forAgent = (value: unknown) => encodeValue(value, { budget: UNBOUNDED_BUDGET });

const requireInteger = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`"${name}" must be an integer.`);
  }
  return value;
};

const requireBoolean = (value: unknown, name: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`"${name}" must be true or false.`);
  }
  return value;
};

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`"${name}" must be a non-empty string.`);
  }
  return value;
};

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

/**
 * Resolves an agent's dot path against the raw state. Segments follow the
 * state, not its encoding: array, Set and Map items by index, then `0` (key)
 * or `1` (value) for a Map entry -- the form `changedPaths` uses. Every
 * segment must exist, except the last when `allowNewKey` is set (a new key on
 * a plain object).
 */
const toStatePath = (
  root: unknown,
  segments: readonly string[],
  allowNewKey = false,
): StatePath => {
  const out: StatePath = [];
  let node = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fail = () => {
      throw new Error(`Path "${segments.slice(0, index + 1).join('.')}" does not exist.`);
    };
    if (Array.isArray(node) || node instanceof Map || node instanceof Set) {
      const size = Array.isArray(node) ? node.length : node.size;
      if (!/^\d+$/.test(segment) || Number(segment) >= size) fail();
      out.push(Number(segment));
      node = readRawPath(node, [Number(segment)]);
      continue;
    }
    if (node === null || typeof node !== 'object') fail();
    const isLast = index === segments.length - 1;
    if (!hasOwn(node as object, segment) && !(isLast && allowNewKey && isPlainObject(node))) {
      fail();
    }
    out.push(segment);
    node = (node as Record<string, unknown>)[segment];
  }
  return out;
};

const parseRequiredPath = (path: unknown): string[] => {
  const segments = parseValuePath(requireString(path, 'path'));
  if (!segments) throw new Error('"path" must name a value inside the state.');
  return segments;
};

export const listStoresResult = (): ZustandAgentListStoresResult => ({
  stores: listStoreIds().map(summarize),
});

export const getStateResult = ({
  storeId,
  ...bounds
}: ZustandAgentGetStateArgs): ZustandAgentGetStateResult => {
  const id = resolveStoreId(storeId);
  const normalized = normalizeBoundedValueArgs(bounds);
  const raw = getSanitizedState(id);
  const node = normalized.path ? readRawPath(raw, toStatePath(raw, normalized.path)) : raw;
  const bounded = boundValue(forAgent(node), {
    maxDepth: normalized.maxDepth,
    maxValueLength: normalized.maxValueLength,
    maxItems: normalized.maxItems,
  });
  return {
    store: summarize(id),
    state: bounded.value,
    ...(normalized.path ? { path: normalized.path.join('.') } : {}),
    truncated: bounded.truncated,
  };
};

export const listTransitionsResult = ({
  storeId,
  limit,
  cursor,
}: ZustandAgentListTransitionsArgs): ZustandAgentListTransitionsResult => {
  const id = resolveStoreId(storeId);
  const { ring } = inspectStore(id);
  const newestFirst = ring.slice().reverse();
  const page = paginateArray(newestFirst, {
    keyOf: (raw) => raw.seq,
    limit,
    cursor,
    scope: id,
    // Seqs restart with a JS reload: a cursor from before it is stale.
    generation: getSessionId(),
  });
  return {
    store: summarize(id),
    items: page.items.map((raw) => summarizeTransition(raw, encodeRawTransition(id, raw))),
    page: page.page,
  };
};

const findTransition = (storeId: string, seq: number) => {
  const raw = inspectStore(storeId).ring.find((entry) => entry.seq === seq);
  if (!raw) {
    throw new Error(
      `Transition ${seq} is not in the device history of "${storeId}" (it keeps the last maxAge entries).`,
    );
  }
  return raw;
};

export const getTransitionResult = ({
  storeId,
  seq,
}: ZustandAgentGetTransitionArgs): ZustandAgentGetTransitionResult => {
  const id = resolveStoreId(storeId);
  const raw = findTransition(id, requireInteger(seq, 'seq'));
  const encoded = encodeRawTransition(id, raw);
  const bounded = boundValue({
    args: encoded.action.args,
    patches: encoded.patches,
  });
  const { args, patches } = bounded.value as Pick<
    ZustandAgentGetTransitionResult,
    'args' | 'patches'
  >;
  return {
    transition: summarizeTransition(raw, encoded),
    args,
    patches,
    truncated: bounded.truncated,
  };
};

export const invokeActionResult = async ({
  storeId,
  action,
  args = [],
}: ZustandAgentInvokeActionArgs): Promise<ZustandAgentInvokeActionResult> => {
  const id = resolveStoreId(storeId);
  const actionPath = requireString(action, 'action');
  if (!Array.isArray(args)) throw new Error('"args" must be an array.');
  // Tagged values (`{ "$t": "date", … }`, as get-state shows them) decode
  // into the real type; plain JSON passes through.
  const result = await invokeStoreAction(id, actionPath, args as EncodedValue[]);
  return { invoked: actionPath, result: forAgent(result) };
};

export const setValueResult = ({
  storeId,
  path,
  value,
}: ZustandAgentSetValueArgs): ZustandAgentApplyResult => {
  const id = resolveStoreId(storeId);
  const statePath = toStatePath(getStoreAdapter(id).getState(), parseRequiredPath(path), true);
  editStoreValue(id, statePath, value as EncodedValue, 'set', `agent: set ${statePath.join('.')}`);
  return { store: summarize(id), applied: true };
};

export const jumpToTransitionResult = ({
  storeId,
  seq,
}: ZustandAgentJumpArgs): ZustandAgentApplyResult => {
  const id = resolveStoreId(storeId);
  jumpTo(id, requireInteger(seq, 'seq'));
  return { store: summarize(id), applied: true };
};

export const setRecordingResult = ({
  storeId,
  value,
}: ZustandAgentSetFlagArgs): ZustandAgentApplyResult => {
  const id = resolveStoreId(storeId);
  setRecording(id, requireBoolean(value, 'value'));
  return { store: summarize(id), applied: true };
};
