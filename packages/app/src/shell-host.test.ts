import { describe, expect, it } from 'vitest';
import { runShellHostConformance } from '@rozenite/shell/testing';
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
