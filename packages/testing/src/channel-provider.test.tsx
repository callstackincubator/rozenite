// @vitest-environment jsdom

import { useEffect, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  createRozeniteRpc,
  getRozeniteDevToolsClient,
  useRozeniteDevToolsClient,
} from '@rozenite/plugin-bridge';
import type { Channel, RozeniteDevToolsRequestClient } from '@rozenite/plugin-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { connectFakePair } from './connect-fake-pair.js';
import { RozeniteChannelProvider } from './index.js';
import { waitForMessage } from './wait-for.js';

const PLUGIN_ID = '@rozenite/fake-plugin';

type RpcMethods = {
  getSnapshot: () => Promise<{ count: number }>;
};

type EventMap = {
  'get-items': Record<string, never>;
  items: { items: string[] };
  'plugin-mounted': { pluginId: string };
};

/**
 * Stands in for a plugin's real panel component: it takes no `channel` prop
 * and knows nothing about tests — exactly the shape `RozeniteChannelProvider`
 * exists to serve.
 */
const Panel = () => {
  const client = useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });
  const [items, setItems] = useState<string[] | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscription = client.onMessage('items', (payload) => {
      setItems(payload.items);
    });
    client.send('get-items', {});

    return () => subscription.remove();
  }, [client]);

  if (!items) {
    return <span>loading</span>;
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

const openClients: RozeniteDevToolsRequestClient<EventMap>[] = [];

const openDeviceClient = async (channel: Channel) => {
  const client = await getRozeniteDevToolsClient<EventMap>(PLUGIN_ID, { channel });
  openClients.push(client);
  return client;
};

afterEach(() => {
  openClients.splice(0).forEach((client) => client.close());
});

describe('RozeniteChannelProvider', () => {
  it('lets a rendered panel talk to a device client over a fake pair', async () => {
    const { device, panel } = connectFakePair();
    const deviceClient = await openDeviceClient(device);

    deviceClient.onMessage('get-items', () => {
      deviceClient.send('items', { items: ['alpha', 'beta'] });
    });

    render(
      <RozeniteChannelProvider channel={panel} role="panel">
        <Panel />
      </RozeniteChannelProvider>,
    );

    expect(await screen.findByText('alpha')).toBeTruthy();
    expect(await screen.findByText('beta')).toBeTruthy();
  });

  it('does not send the device-only plugin-mounted message for role="panel"', async () => {
    const { device, panel } = connectFakePair();
    const deviceClient = await openDeviceClient(device);

    const lifecycleMessages: unknown[] = [];
    deviceClient.onMessage('plugin-mounted', (payload) => {
      lifecycleMessages.push(payload);
    });
    deviceClient.onMessage('get-items', () => {
      deviceClient.send('items', { items: ['alpha'] });
    });

    render(
      <RozeniteChannelProvider channel={panel} role="panel">
        <Panel />
      </RozeniteChannelProvider>,
    );

    // Waiting for the round trip to complete first: `plugin-mounted` would
    // have been sent well before this, so an empty list here is meaningful
    // rather than merely early.
    expect(await screen.findByText('alpha')).toBeTruthy();
    expect(lifecycleMessages).toEqual([]);
  });

  it('announces the device side with plugin-mounted for role="device"', async () => {
    const { device, panel } = connectFakePair();
    const panelClient = await getRozeniteDevToolsClient<EventMap>(PLUGIN_ID, { channel: panel });
    openClients.push(panelClient);

    const DeviceSide = () => {
      useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });
      return null;
    };

    const mounted = waitForMessage(panelClient, 'plugin-mounted', { timeoutMs: 1000 });

    render(
      <RozeniteChannelProvider channel={device} role="device">
        <DeviceSide />
      </RozeniteChannelProvider>,
    );

    expect(await mounted).toEqual({ pluginId: PLUGIN_ID });
  });

  it('supports RPC between a rendered panel and a device handler', async () => {
    const { device, panel } = connectFakePair();
    const deviceClient = await openDeviceClient(device);
    createRozeniteRpc<RpcMethods>(deviceClient).handle('getSnapshot', async () => ({ count: 7 }));

    const RpcPanel = () => {
      const client = useRozeniteDevToolsClient<EventMap>({ pluginId: PLUGIN_ID });
      const [count, setCount] = useState<number | null>(null);

      useEffect(() => {
        if (!client) {
          return;
        }

        let isMounted = true;
        createRozeniteRpc<RpcMethods>(client)
          .method('getSnapshot')
          .invoke()
          .then((snapshot) => {
            if (isMounted) {
              setCount(snapshot.count);
            }
          });

        return () => {
          isMounted = false;
        };
      }, [client]);

      return <span>count: {count ?? '-'}</span>;
    };

    render(
      <RozeniteChannelProvider channel={panel} role="panel">
        <RpcPanel />
      </RozeniteChannelProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('count: 7')).toBeTruthy();
    });
  });
});
