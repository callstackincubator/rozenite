import { useEffect } from 'react';
import { createRozeniteRpc, useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  ZUSTAND_PLUGIN_ID,
  type ZustandEventMap,
  type ZustandMethods,
} from '../../shared/protocol';
import { panelActions, usePanelStore } from './panel-store';
import { hello } from './operations';

const RETRY_MS = 2_000;
const PROBE_MS = 5_000;

/**
 * Owns the bridge client and RPC instance.
 *
 * The device only streams events after a `hello`, so the panel sends one:
 * - on mount, retrying until the app answers;
 * - when the device announces itself with `device-ready` (app reloaded);
 * - when the `ping` probe (every 5 s, and when the panel regains focus)
 *   recovers, reports a new device session, or reports that the device
 *   stopped streaming because the panel went quiet for too long.
 * `hello` is idempotent on the device, and the model deduplicates replays and
 * starts over when the device session id changes. It re-encodes every store,
 * so the probe is what runs on focus.
 */
export const useZustandConnection = () => {
  const client = useRozeniteDevToolsClient<ZustandEventMap>({ pluginId: ZUSTAND_PLUGIN_ID });

  useEffect(() => {
    if (!client) {
      panelActions.setRpc(null);
      return;
    }

    const rpc = createRozeniteRpc<ZustandMethods>(client);
    panelActions.setRpc(rpc);
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let helloInFlight = false;

    const subscription = client.onMessage('zustand-event', (event) => {
      if (event.type === 'device-ready') {
        if (event.sessionId !== usePanelStore.getState().model.sessionId) {
          void sayHello();
        }
        return;
      }
      panelActions.applyEvent(event);
    });

    const sayHello = async () => {
      if (disposed || helloInFlight) return;
      helloInFlight = true;
      try {
        await hello();
      } catch {
        panelActions.setStatus('disconnected');
        if (!disposed) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void sayHello(), RETRY_MS);
        }
      } finally {
        helloInFlight = false;
      }
    };

    void sayHello();

    const probe = async () => {
      if (disposed || helloInFlight) return;
      try {
        const { sessionId, listening } = await rpc
          .method('ping', { ackTimeoutMs: 2_000, retries: 0 })
          .invoke();
        const state = usePanelStore.getState();
        if (
          state.status !== 'connected' ||
          state.model.sessionId !== sessionId ||
          listening === false
        ) {
          void sayHello();
        }
      } catch {
        panelActions.setStatus('disconnected');
      }
    };
    const probeTimer = setInterval(() => void probe(), PROBE_MS);

    const onFocus = () => void probe();
    window.addEventListener('focus', onFocus);

    return () => {
      disposed = true;
      subscription.remove();
      clearInterval(probeTimer);
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('focus', onFocus);
      rpc.close();
      panelActions.setRpc(null);
    };
  }, [client]);
};
