import type { Action } from 'redux';
import type { EnhancedStore, LiftedState } from '@redux-devtools/instrument';

type AnyAction = Action<string> & Record<string, unknown>;

export type ReduxDevToolsEnhancedStore = EnhancedStore<any, AnyAction, unknown>;
export type ReduxDevToolsLiftedState = LiftedState<any, AnyAction, unknown>;

export type ReduxDevToolsStoreRegistration = {
  instanceId: string;
  name: string;
  maxAge: number;
  getStore: () => ReduxDevToolsEnhancedStore | null;
  getLiftedState: () => ReduxDevToolsLiftedState | null;
};

const registry = new Map<string, ReduxDevToolsStoreRegistration>();

export const registerReduxDevToolsStore = (
  registration: ReduxDevToolsStoreRegistration
) => {
  registry.set(registration.instanceId, registration);
};

export const unregisterReduxDevToolsStore = (instanceId: string) => {
  registry.delete(instanceId);
};

export const listReduxDevToolsStores = () => {
  return Array.from(registry.values());
};

export const getReduxDevToolsStore = (instanceId: string) => {
  return registry.get(instanceId) ?? null;
};

export const clearReduxDevToolsStoreRegistryForTests = () => {
  registry.clear();
};
