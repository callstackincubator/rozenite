export { rozenite } from './zustand';
export type { Rozenite, RozeniteActionName, RozeniteOptions } from './zustand';

export type {
  ActionDescriptor,
  PersistInfo,
  StoreDescriptor,
  Transition,
  TransitionSource,
  ZustandHistoryExport,
} from './src/shared/protocol';
export type { EncodedValue, StatePath } from './src/shared/codec';
export type { StatePatch } from './src/shared/patch';

/**
 * Exposes every registered store to Rozenite for Agents (`rozenite agent
 * zustand …`): read state and history, call actions, edit values, time
 * travel and pause recording.
 */
export let useZustandAgentTools: typeof import('./src/runtime/useZustandAgentTools').useZustandAgentTools;

// See zustand.ts for why `lynx` is declared inline.
declare const lynx: unknown;

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined' && typeof lynx === 'undefined';

if (!isDev || isServer) {
  useZustandAgentTools = () => undefined;
} else {
  useZustandAgentTools = require('./src/runtime/useZustandAgentTools').useZustandAgentTools;
}
