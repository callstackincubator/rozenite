import type { Channel } from '@rozenite/plugin-bridge';

type Listener = (message: unknown) => void;

/**
 * Runtime controls for a `connectFakePair()` pair, for simulating transport
 * problems: a side that never mounts (drop everything it would have
 * received) or a slow transport (delay delivery).
 */
export type FakeChannelPairControls = {
  /** Drop every message sent from `device` to `panel` (simulates the panel never mounting). */
  dropDeviceToPanel: (drop: boolean) => void;
  /** Drop every message sent from `panel` to `device` (simulates the device never mounting). */
  dropPanelToDevice: (drop: boolean) => void;
  /** Delay messages sent from `device` to `panel` by `ms` (simulates a slow transport). */
  delayDeviceToPanel: (ms: number) => void;
  /** Delay messages sent from `panel` to `device` by `ms`. */
  delayPanelToDevice: (ms: number) => void;
};

export type FakeChannelPair = FakeChannelPairControls & {
  /**
   * Give this to the device (`react-native.ts`) side, e.g.
   * `getRozeniteDevToolsClient(pluginId, { channel: device })` or
   * `useRozeniteDevToolsClient({ pluginId, channel: device })`.
   */
  device: Channel;
  /** Give this to the panel side, the same way as `device`. */
  panel: Channel;
};

const dispatch = (listeners: Set<Listener>, message: unknown, delayMs: number): void => {
  const run = () => {
    // Snapshot first: a listener reacting to this message by unsubscribing
    // (or subscribing a new listener) must not affect this dispatch.
    Array.from(listeners).forEach((listener) => listener(message));
  };

  if (delayMs > 0) {
    setTimeout(run, delayMs);
  } else {
    // Real transports are never synchronous — queue on the microtask queue
    // so `send()` never re-enters a listener synchronously. This also means
    // a fake pair plays correctly with fake timers in the caller's runner,
    // since nothing here depends on `setTimeout` unless a delay was asked
    // for.
    Promise.resolve().then(run);
  }
};

const createHalf = (
  outgoing: Set<Listener>,
  incoming: Set<Listener>,
  isDropped: () => boolean,
  delayMs: () => number,
): Channel => ({
  send: (message: unknown) => {
    if (isDropped()) {
      return;
    }
    dispatch(outgoing, message, delayMs());
  },
  onMessage: (listener: Listener) => {
    incoming.add(listener);
    return {
      remove: () => {
        incoming.delete(listener);
      },
    };
  },
  close: () => {
    incoming.clear();
  },
});

/**
 * Creates two ends of an in-memory `Channel` pair: whatever `device` sends
 * arrives at `panel`'s listeners (and vice versa), asynchronously — never
 * synchronously inside the `send()` call, matching how every real `Channel`
 * implementation behaves (`postMessage`, CDP).
 *
 * Pass `device` to the device (`react-native.ts`) side of a plugin and
 * `panel` to its panel side, via the `channel` option on
 * `getRozeniteDevToolsClient` / `useRozeniteDevToolsClient` from
 * `@rozenite/plugin-bridge` — both halves then run their real, unmodified
 * protocol code against each other, in-process.
 *
 * A single pair can be shared by multiple plugin clients on each side, the
 * same way a single real channel is shared by every plugin in production:
 * messages are demultiplexed by `pluginId`, not by the channel.
 */
export const connectFakePair = (): FakeChannelPair => {
  const deviceListeners = new Set<Listener>();
  const panelListeners = new Set<Listener>();

  let droppedDeviceToPanel = false;
  let droppedPanelToDevice = false;
  let delayDeviceToPanelMs = 0;
  let delayPanelToDeviceMs = 0;

  const device = createHalf(
    panelListeners,
    deviceListeners,
    () => droppedDeviceToPanel,
    () => delayDeviceToPanelMs,
  );
  const panel = createHalf(
    deviceListeners,
    panelListeners,
    () => droppedPanelToDevice,
    () => delayPanelToDeviceMs,
  );

  return {
    device,
    panel,
    dropDeviceToPanel: (drop) => {
      droppedDeviceToPanel = drop;
    },
    dropPanelToDevice: (drop) => {
      droppedPanelToDevice = drop;
    },
    delayDeviceToPanel: (ms) => {
      delayDeviceToPanelMs = ms;
    },
    delayPanelToDevice: (ms) => {
      delayPanelToDeviceMs = ms;
    },
  };
};
