import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceFrame } from '../../types.js';
import { createLynxTransport } from '../index.js';
import { FakeConnector, makeFakeClient } from './fakes.js';

type Harness = {
  connector: FakeConnector;
  transport: Awaited<ReturnType<typeof createLynxTransport>>;
};

const createHarness = async (): Promise<Harness> => {
  const connector = new FakeConnector();
  const transport = await createLynxTransport({
    createConnector: () => connector,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  });
  return { connector, transport };
};

const harnesses: Harness[] = [];
const setup = async (): Promise<Harness> => {
  const harness = await createHarness();
  harnesses.push(harness);
  return harness;
};

afterEach(async () => {
  while (harnesses.length > 0) {
    await harnesses.pop()?.transport.dispose();
  }
});

const cdpEnvelope = (clientId: number, sessionId: number, message: unknown): string =>
  JSON.stringify({
    event: 'Customized',
    data: {
      type: 'CDP',
      data: { client_id: clientId, session_id: sessionId, message: JSON.stringify(message) },
      sender: clientId,
    },
  });

const sessionListEnvelope = (
  clientId: number,
  sessions: Array<{ session_id: number; url: string; type: string }>,
): string =>
  JSON.stringify({
    event: 'Customized',
    data: { type: 'SessionList', data: sessions, sender: clientId },
  });

const customizedEnvelope = (
  clientId: number,
  sessionId: number,
  type: string,
  data: unknown,
): string =>
  JSON.stringify({
    event: 'Customized',
    data: {
      type,
      data: { client_id: clientId, session_id: sessionId, message: data },
      sender: clientId,
    },
  });

describe('createLynxTransport', () => {
  it('starts discovery on construction, forcing a watch of every device found', async () => {
    const { connector } = await setup();
    expect(connector.connectDevices).toHaveBeenCalledTimes(1);
    expect(connector.startWatchAllClients).toHaveBeenCalledTimes(1);
    expect(connector.startWatchAllClients).toHaveBeenCalledWith(true);
  });

  it('watches the clients of a device that appears after startup, without restarting the others', async () => {
    const { connector, transport } = await setup();
    const device = { startWatchClient: vi.fn() };

    connector.emit('device-connected', device);

    expect(device.startWatchClient).toHaveBeenCalledTimes(1);
    // Still just the forced startup call: a late device is watched on its
    // own, not by re-watching (and so re-registering) every device.
    expect(connector.startWatchAllClients).toHaveBeenCalledTimes(1);

    await transport.dispose();
    connector.emit('device-connected', { startWatchClient: vi.fn() });
    expect(connector.listenerCount('device-connected')).toBe(0);
  });

  describe('device discovery retries', () => {
    // `connectDevices` enumerates what is attached at that instant and
    // stops. Without a retry, a device missed in that one window -- which
    // is capped at three seconds and gets slower with every attached
    // device -- stays invisible until the dev server is restarted.
    it('keeps re-running discovery, so a device missed at startup is still found', async () => {
      vi.useFakeTimers();

      try {
        const connector = new FakeConnector();
        const transport = await createLynxTransport({
          createConnector: () => connector,
          logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        });

        expect(connector.connectDevices).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(15_000);
        expect(connector.connectDevices).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(15_000);
        expect(connector.connectDevices).toHaveBeenCalledTimes(3);

        // Only the startup sweep forces a watch. A forced
        // `startWatchAllClients` recreates every device's client watcher,
        // which drops each connected client and brings it back under a new
        // id -- observed as a `[RECREATING_DEVICE]` close on the host every
        // fifteen seconds. Later sweeps must not do that.
        expect(connector.startWatchAllClients.mock.calls).toEqual([[true], [false], [false]]);

        await transport.dispose();

        // A disposed transport must stop touching the connector.
        await vi.advanceTimersByTimeAsync(60_000);
        expect(connector.connectDevices).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not blank a known client out when discovery re-reports it', async () => {
      const { connector, transport } = await setup();
      const client = makeFakeClient(7);

      connector.emit('client-connected', client);
      connector.emit('usb-client-message', {
        id: 7,
        message: sessionListEnvelope(7, [
          { session_id: 1, url: 'http://localhost:3000/main', type: '' },
        ]),
      });

      expect(transport.listSessions(7)).toHaveLength(1);

      // The same client, reported again by a later sweep. Starting it from
      // scratch would empty its cards until the next session list arrived,
      // making its targets blink out of `/json/list` on every retry.
      connector.emit('client-connected', client);

      expect(transport.listClients()).toHaveLength(1);
      expect(transport.listSessions(7)).toHaveLength(1);
    });
  });

  it('scans localhost by default, so simulators are discovered', async () => {
    // `enableAndroid`/`enableIOS` only reach *physical* devices, over adb
    // and usbmux. A simulator is an ordinary process on the dev machine,
    // so DebugRouter inside it is reachable on 127.0.0.1:8901-8919 — the
    // connector's desktop path. Defaulting `enableDesktop` off silently
    // makes every simulator invisible, which is the common case for a dev
    // server, so it defaults on and this test pins that down.
    const connector = new FakeConnector();
    let received: unknown;
    const transport = await createLynxTransport({
      createConnector: (connectorOptions) => {
        received = connectorOptions;
        return connector;
      },
    });
    harnesses.push({ connector, transport });

    expect(received).toEqual({
      enableAndroid: true,
      enableIOS: true,
      enableHarmony: false,
      enableDesktop: true,
    });
  });

  it('lets a caller turn any discovery path off', async () => {
    const connector = new FakeConnector();
    let received: unknown;
    const transport = await createLynxTransport({
      enableDesktop: false,
      enableHarmony: true,
      createConnector: (connectorOptions) => {
        received = connectorOptions;
        return connector;
      },
    });
    harnesses.push({ connector, transport });

    expect(received).toMatchObject({ enableDesktop: false, enableHarmony: true });
  });

  it('never throws when discovery fails, and keeps watching', async () => {
    const connector = new FakeConnector();
    connector.connectDevices.mockRejectedValueOnce(new Error('no device plugged in'));
    const transport = await createLynxTransport({ createConnector: () => connector });
    harnesses.push({ connector, transport });
    expect(connector.startWatchAllClients).toHaveBeenCalledTimes(1);
  });

  it('maps a connected client into listClients() and fires onTopologyChanged', async () => {
    const { connector, transport } = await setup();
    const onTopologyChanged = vi.fn();
    transport.onTopologyChanged(onTopologyChanged);

    const client = makeFakeClient(7, {
      app: 'com.example.app',
      os: 'Android',
      device: 'Pixel 7',
      device_model: 'Pixel',
      device_id: 'serial-xyz',
      sdk_version: '3.2.1',
    });
    connector.emit('client-connected', client);

    expect(transport.listClients()).toEqual([
      {
        clientId: 7,
        deviceId: 'serial-xyz',
        appName: 'com.example.app',
        deviceName: 'Pixel 7',
        os: 'Android',
        osVersion: undefined,
        sdkVersion: '3.2.1',
        bundleId: undefined,
      },
    ]);
    expect(onTopologyChanged).toHaveBeenCalledTimes(1);
  });

  describe("raw_info (the device's own registration payload)", () => {
    // The connector's flat `query` fields describe the transport that
    // found the client, not the client. On the desktop path -- every iOS
    // Simulator and Android emulator -- they are the *host machine*.
    // Measured on LynxExplorer/iOS via `DesktopDeviceManager`.
    const simulatorQuery = {
      app: 'LynxExplorer',
      os: 'Mac',
      device: 'Mac',
      device_model: 'iPhone_FromMac',
      device_id: 'Mac',
      sdk_version: '1.4.0',
      raw_info: {
        App: 'LynxExplorer',
        bundleId: 'com.lynx.LynxExplorer',
        debugRouterId: 'D376EE65-8F30-4F4A-97E7-EC753C3C2429',
        deviceModel: 'iPhone',
        osType: 'iOS',
        osVersion: '26.4.1',
        sdkVersion: '1.4.0',
      },
    };

    it('reports the device, not the host, for a simulator-hosted app', async () => {
      const { connector, transport } = await setup();
      connector.emit('client-connected', makeFakeClient(3, simulatorQuery));

      expect(transport.listClients()).toEqual([
        {
          clientId: 3,
          // Host id plus the connector's TCP port: two simulators on one
          // machine both report `device_id: 'Mac'` and must not collide.
          deviceId: 'Mac:12345',
          appName: 'LynxExplorer',
          deviceName: 'iPhone',
          os: 'iOS',
          osVersion: '26.4.1',
          sdkVersion: '1.4.0',
          bundleId: 'com.lynx.LynxExplorer',
        },
      ]);
    });

    it('keeps a physical device serial untouched when raw_info agrees on the os', async () => {
      const { connector, transport } = await setup();
      connector.emit(
        'client-connected',
        makeFakeClient(4, {
          os: 'Android',
          device_id: 'serial-xyz',
          raw_info: { osType: 'Android', deviceModel: 'Pixel 7', osVersion: '15' },
        }),
      );

      // No port suffix: `serial-xyz` is already unique, and appending
      // anything would invalidate a DevTools URL saved before this change.
      expect(transport.listClients()[0].deviceId).toBe('serial-xyz');
    });

    it('never derives identity from debugRouterId, which changes on every app launch', async () => {
      const { connector, transport } = await setup();
      const withDebugRouterId = (debugRouterId: string) => ({
        ...simulatorQuery,
        raw_info: { ...simulatorQuery.raw_info, debugRouterId },
      });

      connector.emit('client-connected', makeFakeClient(5, withDebugRouterId('uuid-launch-one')));
      const first = transport.listClients()[0];
      connector.emit('client-disconnected', 5);

      connector.emit('client-connected', makeFakeClient(6, withDebugRouterId('uuid-launch-two')));
      const second = transport.listClients()[0];

      // Same device, same app, different app process: identity must hold.
      expect(second.deviceId).toBe(first.deviceId);
      expect(second.appName).toBe(first.appName);
      expect(second.os).toBe(first.os);
    });

    it('falls back to the flat fields when raw_info is absent or empty', async () => {
      const { connector, transport } = await setup();
      connector.emit(
        'client-connected',
        makeFakeClient(8, {
          app: 'com.example.app',
          os: 'Android',
          device: 'Pixel 7',
          device_id: 'serial-abc',
          sdk_version: '3.2.1',
          raw_info: {},
        }),
      );

      expect(transport.listClients()[0]).toMatchObject({
        deviceId: 'serial-abc',
        appName: 'com.example.app',
        deviceName: 'Pixel 7',
        os: 'Android',
        sdkVersion: '3.2.1',
      });
    });
  });

  it('falls back to device_model when device is empty, and 0.0.0 when sdk_version is missing', async () => {
    const { connector, transport } = await setup();
    const client = makeFakeClient(1, {
      device: '',
      device_model: 'Pixel 8 Pro',
      sdk_version: undefined,
    });
    connector.emit('client-connected', client);

    expect(transport.listClients()).toEqual([
      expect.objectContaining({ deviceName: 'Pixel 8 Pro', sdkVersion: '0.0.0' }),
    ]);
  });

  it('requests a session list as soon as a client connects', async () => {
    const { connector, transport } = await setup();
    const client = makeFakeClient(3);
    connector.emit('client-connected', client);
    void transport;

    expect(client.sentMessages).toEqual([
      {
        event: 'Customized',
        data: { type: 'ListSession', data: { client_id: 3 }, sender: 0 },
      },
    ]);
  });

  it('populates listSessions() from a pushed SessionList, refires only on a real change', async () => {
    const { connector, transport } = await setup();
    connector.emit('client-connected', makeFakeClient(3));

    const onTopologyChanged = vi.fn();
    transport.onTopologyChanged(onTopologyChanged);

    const push = (sessions: Array<{ session_id: number; url: string; type: string }>) =>
      connector.emit('usb-client-message', { id: 3, message: sessionListEnvelope(3, sessions) });

    push([{ session_id: 7, url: 'https://example.com/card.js', type: '' }]);
    expect(transport.listSessions(3)).toEqual([
      { sessionId: 7, url: 'https://example.com/card.js', type: '' },
    ]);
    expect(onTopologyChanged).toHaveBeenCalledTimes(1);

    // Identical repeat push: no re-fire.
    push([{ session_id: 7, url: 'https://example.com/card.js', type: '' }]);
    expect(onTopologyChanged).toHaveBeenCalledTimes(1);

    // A genuinely different push: fires again.
    push([
      { session_id: 7, url: 'https://example.com/card.js', type: '' },
      { session_id: 8, url: 'b', type: 'web' },
    ]);
    expect(onTopologyChanged).toHaveBeenCalledTimes(2);
    expect(transport.listSessions(3)).toHaveLength(2);
  });

  it('surfaces an inbound CDP envelope as a parsed cdp DeviceFrame', async () => {
    const { connector, transport } = await setup();
    const frames: DeviceFrame[] = [];
    transport.onDeviceFrame((frame) => frames.push(frame));

    connector.emit('usb-client-message', {
      id: 3,
      message: cdpEnvelope(3, 7, { method: 'Runtime.consoleAPICalled', params: { type: 'log' } }),
    });

    expect(frames).toEqual([
      {
        kind: 'cdp',
        clientId: 3,
        sessionId: 7,
        message: { method: 'Runtime.consoleAPICalled', params: { type: 'log' } },
      },
    ]);
  });

  it("keys frames off the connector-assigned client id, not the envelope's own client_id/sender", async () => {
    const { connector, transport } = await setup();
    const frames: DeviceFrame[] = [];
    transport.onDeviceFrame((frame) => frames.push(frame));

    // The `client_id`/`sender` fields describe the device's view of a
    // DebugRouter room, which does not exist over a direct USB connection —
    // the device has no way to know the id the connector assigned it. Only
    // the id carried on the `usb-client-message` event is authoritative,
    // and it is what `/json/list` and the WebSocket routes resolve against.
    connector.emit('usb-client-message', {
      id: 3,
      message: cdpEnvelope(-1, 7, { method: 'Runtime.consoleAPICalled', params: {} }),
    });
    connector.emit('usb-client-message', {
      id: 3,
      message: customizedEnvelope(99, 7, 'rozenite', 'payload'),
    });

    expect(frames.map((frame) => frame.clientId)).toEqual([3, 3]);
  });

  it('surfaces an inbound Customized{type:"rozenite"} envelope as a customized DeviceFrame, data preserved verbatim', async () => {
    const { connector, transport } = await setup();
    const frames: DeviceFrame[] = [];
    transport.onDeviceFrame((frame) => frames.push(frame));

    const payload = { channel: 'network-plugin', nested: { a: 1, b: [1, 2, 3] } };
    connector.emit('usb-client-message', {
      id: 3,
      message: customizedEnvelope(3, -1, 'rozenite', payload),
    });

    expect(frames).toEqual([
      { kind: 'customized', clientId: 3, sessionId: -1, type: 'rozenite', data: payload },
    ]);
    // Verbatim means the same value, not a stringified/re-parsed copy.
    expect(frames[0]).toMatchObject({ data: payload });
  });

  it('drops a Customized frame of an unrecognized shape without throwing or producing a frame', async () => {
    const { connector, transport } = await setup();
    const frames: DeviceFrame[] = [];
    transport.onDeviceFrame((frame) => frames.push(frame));

    // Shaped like DebugRouter's own `OpenCard` customized message: no
    // `client_id`/`session_id`, so it does not match the shape this
    // transport knows how to surface.
    const raw = JSON.stringify({
      event: 'Customized',
      data: { type: 'OpenCard', data: { type: 'card', url: 'https://example.com' }, sender: 3 },
    });

    expect(() => connector.emit('usb-client-message', { id: 3, message: raw })).not.toThrow();
    expect(frames).toEqual([]);
  });

  it('ignores a malformed/non-JSON usb-client-message without throwing', async () => {
    const { connector, transport } = await setup();
    const frames: DeviceFrame[] = [];
    transport.onDeviceFrame((frame) => frames.push(frame));

    expect(() =>
      connector.emit('usb-client-message', { id: 3, message: 'not json at all {{{' }),
    ).not.toThrow();
    expect(frames).toEqual([]);
  });

  it('sendCdpMessage wraps the message verbatim, preserving id, and writes via client.sendMessage', async () => {
    const { connector, transport } = await setup();
    const client = makeFakeClient(3);
    connector.emit('client-connected', client);
    client.sentMessages.length = 0; // drop the ListSession request made on connect

    const message = { id: 1, method: 'Runtime.enable', params: {} };
    transport.sendCdpMessage(3, 7, message);

    expect(client.sentMessages).toEqual([
      {
        event: 'Customized',
        data: { type: 'CDP', data: { client_id: -1, session_id: 7, message }, sender: 0 },
      },
    ]);
    // Same object reference: the caller's message was not cloned or mutated.
    const sent = client.sentMessages[0] as { data: { data: { message: unknown } } };
    expect(sent.data.data.message).toBe(message);
    expect(message).toEqual({ id: 1, method: 'Runtime.enable', params: {} });
  });

  it('sendCdpMessage to an unknown client does not throw', async () => {
    const { transport } = await setup();
    expect(() =>
      transport.sendCdpMessage(999, 1, { id: 1, method: 'Runtime.enable' }),
    ).not.toThrow();
  });

  it('client-disconnected removes the client and fires onTopologyChanged', async () => {
    const { connector, transport } = await setup();
    connector.emit('client-connected', makeFakeClient(3));

    const onTopologyChanged = vi.fn();
    transport.onTopologyChanged(onTopologyChanged);

    connector.emit('client-disconnected', 3);

    expect(transport.listClients()).toEqual([]);
    expect(onTopologyChanged).toHaveBeenCalledTimes(1);
  });

  it('client-disconnected for an unknown client id is a no-op, no re-fire', async () => {
    const { connector, transport } = await setup();
    const onTopologyChanged = vi.fn();
    transport.onTopologyChanged(onTopologyChanged);

    connector.emit('client-disconnected', 12345);

    expect(onTopologyChanged).not.toHaveBeenCalled();
  });

  it('dispose() unsubscribes every connector listener and closes connected clients, and is idempotent', async () => {
    const { connector, transport } = await setup();
    const client = makeFakeClient(3);
    connector.emit('client-connected', client);

    expect(connector.listenerCount('client-connected')).toBeGreaterThan(0);
    expect(connector.listenerCount('client-disconnected')).toBeGreaterThan(0);
    expect(connector.listenerCount('usb-client-message')).toBeGreaterThan(0);

    await transport.dispose();

    expect(connector.listenerCount('client-connected')).toBe(0);
    expect(connector.listenerCount('client-disconnected')).toBe(0);
    expect(connector.listenerCount('usb-client-message')).toBe(0);
    expect(client.closed).toBe(true);
    expect(connector.close).toHaveBeenCalledTimes(1);

    // Second call: no throw, no double-close.
    await expect(transport.dispose()).resolves.toBeUndefined();
    expect(connector.close).toHaveBeenCalledTimes(1);

    // Remove from the afterEach cleanup queue: already disposed above.
    harnesses.pop();
  });

  it('onDeviceFrame and onTopologyChanged unsubscribe functions stop delivery', async () => {
    const { connector, transport } = await setup();
    const onTopologyChanged = vi.fn();
    const unsubscribe = transport.onTopologyChanged(onTopologyChanged);
    unsubscribe();

    connector.emit('client-connected', makeFakeClient(1));
    expect(onTopologyChanged).not.toHaveBeenCalled();
  });
});
