import type { ShellHost } from '@rozenite/shell';
import type { DeviceConnection } from './connection/device-connection';

/**
 * The envelope panel iframes wrap outgoing messages in before `Shell`
 * forwards them to `host.send` verbatim (see
 * `packages/plugin-bridge/src/channel/browser/panel-channel.ts`'s `send`,
 * and `Shell.tsx`'s `forwardToHost`, which hands `event.data` straight to
 * `host.send` without touching it).
 */
type RozeniteMessageEnvelope = { type: 'rozenite-message'; payload: unknown };

const isRozeniteMessageEnvelope = (message: unknown): message is RozeniteMessageEnvelope => {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'rozenite-message' &&
    'payload' in message
  );
};

/**
 * Adapts a `DeviceConnection` to the shell's `ShellHost` contract, so the
 * same `Shell` component that's embedded in React Native DevTools (talking
 * to `window.parent` via `createParentWindowHost`) can run standalone here,
 * talking to a device over CDP instead.
 *
 * The two directions are deliberately asymmetric — this is load-bearing,
 * not a bug:
 *
 * - Outgoing (`send`): the message the shell hands over is always the whole
 *   panel envelope it just received, `{ type: 'rozenite-message', payload
 *   }`. This unwraps `.payload` and forwards only that to the device,
 *   mirroring what `packages/runtime/src/rn-devtools/plugin-view.ts` does on
 *   the embedded side (`model.sendMessage(event.data.payload)`). A message
 *   that isn't in that shape is forwarded through unchanged rather than
 *   dropped — nothing in this app's `Shell` usage ever produces one, but a
 *   generic `ShellHost` still has to behave like a well-defined channel for
 *   whatever it's handed (see `runShellHostConformance`).
 * - Incoming (`onMessage`): messages arriving from the device are already
 *   raw `DevToolsPluginMessage` objects (`{ pluginId, type, payload }`) —
 *   there is no envelope to undo. They're passed to the listener unchanged;
 *   `Shell` routes them to the right panel by `pluginId` itself.
 *
 * Create this once per `connection` (module scope, or `useMemo` keyed on a
 * stable `connection` reference) — `Shell` requires a stable `host` prop
 * and resubscribes from it whenever the reference changes.
 */
export const createDeviceShellHost = (connection: DeviceConnection): ShellHost => {
  return {
    send: (message: unknown) => {
      connection.send(isRozeniteMessageEnvelope(message) ? message.payload : message);
    },
    onMessage: (listener: (message: unknown) => void) => connection.onMessage(listener),
  };
};
