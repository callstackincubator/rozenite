// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock react-native BEFORE importing modules that read NativeModules so
// `resolveMetroOrigin` reads the value we set per test.
const mockScriptURL = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock('react-native', () => ({
  NativeModules: {
    get SourceCode() {
      return { scriptURL: mockScriptURL.value };
    },
  },
}));

import {
  useReactNavigationEvents,
  type ActionDataEvent,
} from '../useReactNavigationEvents';
import { __resetMetroOriginCache } from '../symbolication/metro';

type ListenerMap = Map<string, (event: unknown) => void>;

type MockNavigation = {
  __listeners: ListenerMap;
  addListener: (
    event: string,
    listener: (event: unknown) => void,
  ) => () => void;
  getRootState: () => undefined;
  resetRoot: () => void;
  emit: (event: string, payload: unknown) => void;
  hasListener: (event: string) => boolean;
};

const createMockNavigation = (): MockNavigation => {
  const listeners: ListenerMap = new Map();
  return {
    __listeners: listeners,
    addListener: (event, listener) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    },
    getRootState: () => undefined,
    resetRoot: () => {},
    emit: (event, payload) => {
      const fn = listeners.get(event);
      fn?.(payload);
    },
    hasListener: (event) => listeners.has(event),
  };
};

const sampleStack = (suffix = 'A') =>
  `at handleClick (http://localhost:8081/index.bundle?platform=ios:12345:10)\n` +
  `at onPress${suffix} (http://localhost:8081/index.bundle?platform=ios:12345:20)`;

const okSymbolicateResponse = () =>
  new Response(
    JSON.stringify({
      stack: [
        {
          methodName: 'handleClick',
          file: 'apps/playground/src/Screen.tsx',
          lineNumber: 42,
          column: 5,
        },
        {
          methodName: 'onPress',
          file: 'apps/playground/src/Screen.tsx',
          lineNumber: 41,
          column: 3,
        },
      ],
    }),
    { status: 200 },
  );

beforeEach(() => {
  __resetMetroOriginCache();
  mockScriptURL.value = 'http://localhost:8081/index.bundle';
});

describe('useReactNavigationEvents', () => {
  it('emits action with pending origin then a follow-up symbolicated event on a cache miss', async () => {
    const fetchMock = vi.fn(async () => okSymbolicateResponse());
    vi.stubGlobal('fetch', fetchMock);

    try {
      const events: ActionDataEvent[] = [];
      const nav = createMockNavigation();
      const ref = { current: nav } as unknown as React.RefObject<
        Parameters<typeof useReactNavigationEvents>[0]['current']
      >;

      renderHook(() =>
        useReactNavigationEvents(ref, (event) => events.push(event)),
      );

      await waitFor(() =>
        expect(nav.hasListener('__unsafe_action__')).toBe(true),
      );

      nav.emit('__unsafe_action__', {
        data: {
          action: { type: 'NAVIGATE', payload: { name: 'Home' } },
          stack: sampleStack(),
          noop: true,
        },
      });

      await waitFor(() => expect(events).toHaveLength(2));

      expect(events[0]).toMatchObject({
        type: 'action',
        origin: { symbolicationStatus: 'pending' },
      });
      expect(events[0].type === 'action' && events[0].id).toBeGreaterThan(0);

      const id = events[0].type === 'action' ? events[0].id : -1;
      expect(events[1]).toMatchObject({
        type: 'action-symbolicated',
        id,
        origin: {
          symbolicationStatus: 'complete',
          confidence: 'high',
        },
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('emits a single complete action when the same callsite dispatches again (cache hit)', async () => {
    const fetchMock = vi.fn(async () => okSymbolicateResponse());
    vi.stubGlobal('fetch', fetchMock);

    try {
      const events: ActionDataEvent[] = [];
      const nav = createMockNavigation();
      const ref = { current: nav } as unknown as React.RefObject<
        Parameters<typeof useReactNavigationEvents>[0]['current']
      >;

      renderHook(() =>
        useReactNavigationEvents(ref, (event) => events.push(event)),
      );
      await waitFor(() =>
        expect(nav.hasListener('__unsafe_action__')).toBe(true),
      );

      const stack = sampleStack();
      nav.emit('__unsafe_action__', {
        data: {
          action: { type: 'NAVIGATE', payload: { name: 'A' } },
          stack,
          noop: true,
        },
      });

      // Wait until the first dispatch has gone through pending → symbolicated.
      await waitFor(() => expect(events).toHaveLength(2));
      const cachedEventCount = events.length;

      nav.emit('__unsafe_action__', {
        data: {
          action: { type: 'NAVIGATE', payload: { name: 'A again' } },
          stack,
          noop: true,
        },
      });

      // Second dispatch: a single action event with status: 'complete'
      // and no follow-up symbolicated event (fetch only called once for
      // both dispatches).
      await waitFor(() => expect(events).toHaveLength(cachedEventCount + 1));

      const secondAction = events[cachedEventCount];
      expect(secondAction).toMatchObject({
        type: 'action',
        origin: {
          symbolicationStatus: 'complete',
          confidence: 'high',
        },
      });

      // Give any spurious second event a tick to land.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(events).toHaveLength(cachedEventCount + 1);
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('emits a single action with no origin when React Navigation does not supply a stack', async () => {
    const fetchMock = vi.fn(async () => okSymbolicateResponse());
    vi.stubGlobal('fetch', fetchMock);

    try {
      const events: ActionDataEvent[] = [];
      const nav = createMockNavigation();
      const ref = { current: nav } as unknown as React.RefObject<
        Parameters<typeof useReactNavigationEvents>[0]['current']
      >;

      renderHook(() =>
        useReactNavigationEvents(ref, (event) => events.push(event)),
      );
      await waitFor(() =>
        expect(nav.hasListener('__unsafe_action__')).toBe(true),
      );

      nav.emit('__unsafe_action__', {
        data: {
          action: { type: 'NAVIGATE', payload: { name: 'Home' } },
          stack: undefined,
          noop: true,
        },
      });

      await waitFor(() => expect(events).toHaveLength(1));

      expect(events[0]).toMatchObject({ type: 'action' });
      expect(events[0].type === 'action' && events[0].origin).toBeUndefined();

      // No symbolication attempt should have been made.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(events).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
