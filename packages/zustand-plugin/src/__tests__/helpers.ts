import { vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { rozeniteImpl, type RozeniteOptions } from '../zustand/middleware';

// The only thing stubbed: connecting to a real DevTools socket. Registered
// here, so a test file must import this module before anything that loads
// the bridge.
vi.mock('../runtime/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../runtime/bridge')>()),
  ensureBridge: () => undefined,
}));

export type TrackedSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
  replace?: false,
  action?: string | { type: string; [key: string]: unknown },
) => void;

/** A vanilla store wrapped in `rozenite()`, named `name`. */
export const createTracked = <T extends object>(
  name: string,
  init: (set: TrackedSet<T>, get: () => T) => T,
  options: Omit<RozeniteOptions, 'name'> = {},
): StoreApi<T> =>
  createStore<T>()(rozeniteImpl(init as never, { name, ...options }) as never) as StoreApi<T>;
