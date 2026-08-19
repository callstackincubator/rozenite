import { describe, expect, it } from 'vitest';
import { DROPPED, runShellHostConformance } from '@rozenite/shell/testing';
import { createDeviceShellHost } from './shell-host';
import type { DeviceConnection } from './connection/device-connection';

/** A minimal `DeviceConnection` double: only `send`/`onMessage` matter for
 * `createDeviceShellHost`, but the type requires the rest of the surface. */
const createFakeConnection = (): {
  connection: DeviceConnection;
  sentMessages: unknown[];
  deliver: (message: unknown) => void;
} => {
  const messageListeners = new Set<(message: unknown) => void>();
  const sentMessages: unknown[] = [];

  const connection: DeviceConnection = {
    getState: () => ({ status: 'connected' }),
    subscribe: () => () => {},
    send: (message: unknown) => {
      sentMessages.push(message);
    },
    onMessage: (listener: (message: unknown) => void) => {
      messageListeners.add(listener);
      return () => {
        messageListeners.delete(listener);
      };
    },
    getTarget: () => ({ name: 'Fake Device', appId: 'com.example.app' }),
    reconnect: () => {},
    close: () => {},
  };

  return {
    connection,
    sentMessages,
    deliver: (message: unknown) => {
      for (const listener of messageListeners) {
        listener(message);
      }
    },
  };
};

runShellHostConformance('createDeviceShellHost', () => {
  const { connection, sentMessages, deliver } = createFakeConnection();
  return {
    host: createDeviceShellHost(connection),
    sent: () => sentMessages,
    deliver,
    // The suite's generic `send` case exercises a plain, non-envelope
    // message — a shape this host never actually receives from `Shell`
    // (see the module doc comment) and, on its own merits, drops rather
    // than forwards.
    expectedSent: () => DROPPED,
  };
});

describe('createDeviceShellHost unwrap direction', () => {
  it('unwraps a panel envelope and forwards only its `.payload` to the device', () => {
    const { connection, sentMessages } = createFakeConnection();
    const host = createDeviceShellHost(connection);
    const panelMessage = { pluginId: 'plugin-a', type: 'ping', payload: null };

    host.send({ type: 'rozenite-message', payload: panelMessage });

    expect(sentMessages).toEqual([panelMessage]);
  });

  it('drops a message that is not a rozenite-message envelope instead of forwarding it as-is', () => {
    const { connection, sentMessages } = createFakeConnection();
    const host = createDeviceShellHost(connection);

    host.send({ hello: 'world' });

    expect(sentMessages).toEqual([]);
  });

  it('passes incoming device messages to listeners unchanged, with no wrapping to undo', () => {
    const { connection, deliver } = createFakeConnection();
    const host = createDeviceShellHost(connection);
    const received: unknown[] = [];
    host.onMessage((message) => received.push(message));

    const deviceMessage = { pluginId: 'plugin-a', type: 'pong', payload: { ok: true } };
    deliver(deviceMessage);

    expect(received).toEqual([deviceMessage]);
  });
});
