import type {
  NavigationAction,
  NavigationContainerRef,
  NavigationState,
} from '@react-navigation/core';
import deepEqual from 'fast-deep-equal';
import { useRef, useEffect, useCallback } from 'react';
import {
  createDispatchOriginCache,
  resolveDispatchOrigin,
  type DispatchOriginCache,
} from './dispatchOrigin';
import type { ActionOrigin } from './symbolication';

export type ActionDataEvent =
  | {
      type: 'action';
      id: number;
      action: NavigationAction;
      state: NavigationState | undefined;
      origin?: ActionOrigin;
    }
  | {
      type: 'action-symbolicated';
      id: number;
      origin: ActionOrigin;
    };

// This is a copy of useDevToolsBase from the @react-navigation/devtools package
export function useReactNavigationEvents(
  ref: React.RefObject<NavigationContainerRef<any> | null>,
  callback: (result: ActionDataEvent) => void,
) {
  const lastStateRef = useRef<NavigationState | undefined>(undefined);
  const lastActionRef = useRef<
    { action: NavigationAction; stack: string | undefined } | undefined
  >(undefined);
  const callbackRef = useRef(callback);
  const lastResetRef = useRef<NavigationState | undefined>(undefined);
  const nextIdRef = useRef(1);
  const cacheRef = useRef<DispatchOriginCache | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = createDispatchOriginCache();
  }

  useEffect(() => {
    callbackRef.current = callback;
  });

  const pendingPromiseRef = useRef<Promise<void>>(Promise.resolve());

  const send = useCallback(
    (data: {
      action: NavigationAction;
      state: NavigationState | undefined;
      stack: string | undefined;
    }) => {
      // We need to make sure that our callbacks executed in the same order
      // So we add check if the last promise is settled before sending the next one
      pendingPromiseRef.current = pendingPromiseRef.current
        .catch(() => {
          // Ignore any errors from the last promise
        })
        .then(() => {
          const id = nextIdRef.current++;
          let initialOrigin: ActionOrigin | undefined;
          let pendingResolution: Promise<ActionOrigin> | undefined;

          if (data.stack) {
            const resolved = resolveDispatchOrigin(data.stack, {
              cache: cacheRef.current!,
            });
            initialOrigin = resolved.initialOrigin;
            pendingResolution = resolved.pendingResolution;
          }

          callbackRef.current({
            type: 'action',
            id,
            action: data.action,
            state: data.state,
            origin: initialOrigin,
          });

          if (pendingResolution) {
            // Fire-and-forget: the action event is already delivered;
            // the symbolicated event arrives whenever Metro responds.
            pendingResolution.then((resolved) => {
              callbackRef.current({
                type: 'action-symbolicated',
                id,
                origin: resolved,
              });
            });
          }
        });
    },
    [],
  );

  useEffect(() => {
    let timer: any;
    let unsubscribeAction: (() => void) | undefined;
    let unsubscribeState: (() => void) | undefined;

    const initialize = async () => {
      if (!ref.current) {
        // If the navigation object isn't ready yet, wait for it
        await new Promise<void>((resolve) => {
          timer = setInterval(() => {
            if (ref.current) {
              resolve();
              clearTimeout(timer);
              const state = ref.current.getRootState();

              lastStateRef.current = state;
            }
          }, 100);
        });
      }

      const navigation = ref.current!;

      unsubscribeAction = navigation.addListener('__unsafe_action__', (e) => {
        const action = e.data.action;

        if (e.data.noop) {
          // Even if the state didn't change, it's useful to show the action
          send({
            action,
            state: lastStateRef.current,
            stack: e.data.stack,
          });
        } else {
          lastActionRef.current = e.data;
        }
      });

      unsubscribeState = navigation.addListener('state', (e) => {
        // Don't show the action in dev tools if the state is what we sent to reset earlier
        if (
          lastResetRef.current &&
          deepEqual(lastResetRef.current, e.data.state)
        ) {
          lastStateRef.current = undefined;
          return;
        }

        const state = navigation.getRootState();
        const lastState = lastStateRef.current;
        const lastChange = lastActionRef.current;

        lastActionRef.current = undefined;
        lastStateRef.current = state;

        // If we don't have an action and the state didn't change, then it's probably extraneous
        if (lastChange === undefined && deepEqual(state, lastState)) {
          return;
        }

        send({
          action: lastChange ? lastChange.action : { type: '@@UNKNOWN' },
          state,
          stack: lastChange?.stack,
        });
      });
    };

    initialize();

    return () => {
      unsubscribeAction?.();
      unsubscribeState?.();
      clearTimeout(timer);
    };
  }, [ref, send]);

  const resetRoot = useCallback(
    (state: NavigationState) => {
      if (ref.current) {
        lastResetRef.current = state;
        ref.current.resetRoot(state);
      }
    },
    [ref],
  );

  return { resetRoot };
}
