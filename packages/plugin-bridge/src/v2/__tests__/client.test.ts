import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '../clients/factory.js';
import { RozeniteDevToolsManualClient } from '../clients/types.js';
import { MockChannel, createMockChannelPair } from '../test-utils/mock-channel.js';

type TestEventMap = {
  'test-event': { message: string };
  'another-event': { count: number };
  'ping': { id: number };
  'pong': { id: number };
};

describe('Plugin Bridge v2 - Client', () => {
  let deviceChannel: MockChannel;
  let panelChannel: MockChannel;

  beforeEach(() => {
    [deviceChannel, panelChannel] = createMockChannelPair();
  });

  describe('Auto-ready mode', () => {
    it('should complete handshake when first listener is added', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      expect(deviceClient.isReady()).toBe(false);
      expect(panelClient.isReady()).toBe(false);

      const deviceReadyPromise = new Promise<void>((resolve) => {
        deviceClient.onReady(resolve);
      });

      const panelReadyPromise = new Promise<void>((resolve) => {
        panelClient.onReady(resolve);
      });

      // Add listeners to trigger auto-ready
      deviceClient.onMessage('test-event', () => {});
      panelClient.onMessage('test-event', () => {});

      // Wait for handshake to complete
      await Promise.all([deviceReadyPromise, panelReadyPromise]);

      expect(deviceClient.isReady()).toBe(true);
      expect(panelClient.isReady()).toBe(true);

      deviceClient.close();
      panelClient.close();
    });

    it('should send and receive messages after handshake', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const deviceMessages: Array<{ message: string }> = [];
      const panelMessages: Array<{ message: string }> = [];

      deviceClient.onMessage('test-event', (payload) => {
        deviceMessages.push(payload);
      });

      panelClient.onMessage('test-event', (payload) => {
        panelMessages.push(payload);
      });

      // Wait for handshake
      await new Promise<void>((resolve) => {
        let readyCount = 0;
        const checkReady = () => {
          readyCount++;
          if (readyCount === 2) resolve();
        };
        deviceClient.onReady(checkReady);
        panelClient.onReady(checkReady);
      });

      panelClient.send('test-event', { message: 'from panel' });
      deviceClient.send('test-event', { message: 'from device' });

      // Wait for messages to be delivered
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(deviceMessages).toHaveLength(1);
      expect(deviceMessages[0]).toEqual({ message: 'from panel' });

      expect(panelMessages).toHaveLength(1);
      expect(panelMessages[0]).toEqual({ message: 'from device' });

      deviceClient.close();
      panelClient.close();
    });

    it('should queue messages sent before handshake completes', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const receivedMessages: Array<{ message: string }> = [];

      // Send messages before handshake
      panelClient.send('test-event', { message: 'early message 1' });
      panelClient.send('test-event', { message: 'early message 2' });

      // Add listener to trigger handshake
      deviceClient.onMessage('test-event', (payload) => {
        receivedMessages.push(payload);
      });

      panelClient.onMessage('test-event', () => {});

      // Wait for handshake and message delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Queued messages should be delivered
      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0]).toEqual({ message: 'early message 1' });
      expect(receivedMessages[1]).toEqual({ message: 'early message 2' });

      deviceClient.close();
      panelClient.close();
    });

    it('should filter messages by type', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const testEvents: Array<{ message: string }> = [];
      const anotherEvents: Array<{ count: number }> = [];

      deviceClient.onMessage('test-event', (payload) => {
        testEvents.push(payload);
      });

      deviceClient.onMessage('another-event', (payload) => {
        anotherEvents.push(payload);
      });

      panelClient.onMessage('test-event', () => {});

      // Wait for handshake
      await new Promise((resolve) => setTimeout(resolve, 50));

      panelClient.send('test-event', { message: 'hello' });
      panelClient.send('another-event', { count: 42 });
      panelClient.send('test-event', { message: 'world' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(testEvents).toHaveLength(2);
      expect(testEvents[0]).toEqual({ message: 'hello' });
      expect(testEvents[1]).toEqual({ message: 'world' });

      expect(anotherEvents).toHaveLength(1);
      expect(anotherEvents[0]).toEqual({ count: 42 });

      deviceClient.close();
      panelClient.close();
    });

    it('should handle multiple listeners for the same event type', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const listener1Messages: Array<{ message: string }> = [];
      const listener2Messages: Array<{ message: string }> = [];

      deviceClient.onMessage('test-event', (payload) => {
        listener1Messages.push(payload);
      });

      deviceClient.onMessage('test-event', (payload) => {
        listener2Messages.push(payload);
      });

      panelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      panelClient.send('test-event', { message: 'broadcast' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(listener1Messages).toHaveLength(1);
      expect(listener1Messages[0]).toEqual({ message: 'broadcast' });

      expect(listener2Messages).toHaveLength(1);
      expect(listener2Messages[0]).toEqual({ message: 'broadcast' });

      deviceClient.close();
      panelClient.close();
    });

    it('should handle listener removal', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const messages: Array<{ message: string }> = [];

      const subscription = deviceClient.onMessage('test-event', (payload) => {
        messages.push(payload);
      });

      panelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      panelClient.send('test-event', { message: 'first' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      subscription.remove();

      panelClient.send('test-event', { message: 'second' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ message: 'first' });

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Manual-ready mode', () => {
    it('should not start handshake until makeReady is called', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: deviceChannel,
        isLeader: false,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: panelChannel,
        isLeader: true,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      // Add listeners
      deviceClient.onMessage('test-event', () => {});
      panelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not be ready yet
      expect(deviceClient.isReady()).toBe(false);
      expect(panelClient.isReady()).toBe(false);

      // Call makeReady
      deviceClient.makeReady();
      panelClient.makeReady();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(deviceClient.isReady()).toBe(true);
      expect(panelClient.isReady()).toBe(true);

      deviceClient.close();
      panelClient.close();
    });

    it('should queue messages until makeReady is called', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: deviceChannel,
        isLeader: false,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: panelChannel,
        isLeader: true,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const messages: Array<{ message: string }> = [];

      deviceClient.onMessage('test-event', (payload: { message: string }) => {
        messages.push(payload);
      });

      panelClient.onMessage('test-event', () => {});

      // Send before ready
      panelClient.send('test-event', { message: 'queued' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages).toHaveLength(0);

      // Make ready
      deviceClient.makeReady();
      panelClient.makeReady();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ message: 'queued' });

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Handshake protocol', () => {
    it('should follow INIT -> ACK -> COMPLETE sequence', async () => {
      const handshakeSequence: string[] = [];

      // Spy on channel send to track handshake messages
      const originalDeviceSend = deviceChannel.send.bind(deviceChannel);
      const originalPanelSend = panelChannel.send.bind(panelChannel);

      deviceChannel.send = vi.fn((message: any) => {
        if (message.type?.startsWith('__HANDSHAKE_')) {
          handshakeSequence.push(`device:${message.type}`);
        }
        originalDeviceSend(message);
      });

      panelChannel.send = vi.fn((message: any) => {
        if (message.type?.startsWith('__HANDSHAKE_')) {
          handshakeSequence.push(`panel:${message.type}`);
        }
        originalPanelSend(message);
      });

      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      deviceClient.onMessage('test-event', () => {});
      panelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handshakeSequence).toEqual([
        'panel:__HANDSHAKE_INIT__',
        'device:__HANDSHAKE_ACK__',
        'panel:__HANDSHAKE_COMPLETE__',
      ]);

      deviceClient.close();
      panelClient.close();
    });

    it('should isolate messages by pluginId', async () => {
      const plugin1DeviceClient = await createClient<TestEventMap>({
        pluginId: 'plugin-1',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const plugin1PanelClient = await createClient<TestEventMap>({
        pluginId: 'plugin-1',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const plugin2DeviceClient = await createClient<TestEventMap>({
        pluginId: 'plugin-2',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const plugin2PanelClient = await createClient<TestEventMap>({
        pluginId: 'plugin-2',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      const plugin1Messages: Array<{ message: string }> = [];
      const plugin2Messages: Array<{ message: string }> = [];

      plugin1DeviceClient.onMessage('test-event', (payload) => {
        plugin1Messages.push(payload);
      });

      plugin1PanelClient.onMessage('test-event', () => {});

      plugin2DeviceClient.onMessage('test-event', (payload) => {
        plugin2Messages.push(payload);
      });

      plugin2PanelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      plugin1PanelClient.send('test-event', { message: 'for plugin 1' });
      plugin2PanelClient.send('test-event', { message: 'for plugin 2' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(plugin1Messages).toHaveLength(1);
      expect(plugin1Messages[0]).toEqual({ message: 'for plugin 1' });

      expect(plugin2Messages).toHaveLength(1);
      expect(plugin2Messages[0]).toEqual({ message: 'for plugin 2' });

      plugin1DeviceClient.close();
      plugin1PanelClient.close();
      plugin2DeviceClient.close();
      plugin2PanelClient.close();
    });
  });

  describe('Edge cases', () => {
    it('should handle close during handshake', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: deviceChannel,
        isLeader: false,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: panelChannel,
        isLeader: true,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      deviceClient.makeReady();
      panelClient.makeReady();

      // Close before handshake completes
      deviceClient.close();
      panelClient.close();

      // Should not throw
      expect(deviceClient.isReady()).toBe(false);
    });

    it('should handle onReady callback when already ready', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      deviceClient.onMessage('test-event', () => {});
      panelClient.onMessage('test-event', () => {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(deviceClient.isReady()).toBe(true);

      // Add onReady callback after already ready
      const readyCallback = vi.fn();
      deviceClient.onReady(readyCallback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(readyCallback).toHaveBeenCalledTimes(1);

      deviceClient.close();
      panelClient.close();
    });

    it('should handle sending multiple message types before handshake', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: deviceChannel,
        isLeader: false,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'manual',
        channel: panelChannel,
        isLeader: true,
      }) as RozeniteDevToolsManualClient<TestEventMap>;

      const testEvents: Array<{ message: string }> = [];
      const anotherEvents: Array<{ count: number }> = [];

      deviceClient.onMessage('test-event', (payload: { message: string }) => testEvents.push(payload));
      deviceClient.onMessage('another-event', (payload: { count: number }) => anotherEvents.push(payload));
      panelClient.onMessage('test-event', () => {});

      // Send before ready
      panelClient.send('test-event', { message: 'msg1' });
      panelClient.send('another-event', { count: 1 });
      panelClient.send('test-event', { message: 'msg2' });
      panelClient.send('another-event', { count: 2 });

      // Make ready
      deviceClient.makeReady();
      panelClient.makeReady();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(testEvents).toHaveLength(2);
      expect(testEvents[0]).toEqual({ message: 'msg1' });
      expect(testEvents[1]).toEqual({ message: 'msg2' });

      expect(anotherEvents).toHaveLength(2);
      expect(anotherEvents[0]).toEqual({ count: 1 });
      expect(anotherEvents[1]).toEqual({ count: 2 });

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Re-initialization', () => {
    it('should handle DevTools UI reload while device is still connected', async () => {
      const [panelChannel, deviceChannel] = createMockChannelPair();

      // Create and initialize device client
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: deviceChannel,
        isLeader: false,
      });

      // Create first panel client and complete handshake
      const panelClient1 = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      // Wait for both to be ready
      await new Promise<void>((resolve) => {
        let deviceReady = false;
        let panelReady = false;
        
        const checkBothReady = () => {
          if (deviceReady && panelReady) {
            resolve();
          }
        };
        
        if (deviceClient.isReady()) {
          deviceReady = true;
        } else {
          deviceClient.onReady(() => {
            deviceReady = true;
            checkBothReady();
          });
        }
        
        if (panelClient1.isReady()) {
          panelReady = true;
        } else {
          panelClient1.onReady(() => {
            panelReady = true;
            checkBothReady();
          });
        }
        
        checkBothReady();
      });

      expect(deviceClient.isReady()).toBe(true);
      expect(panelClient1.isReady()).toBe(true);

      // Close the first panel client (simulating DevTools UI close)
      panelClient1.close();

      // Create a new panel client (simulating DevTools UI reload)
      // Use the same panelChannel to simulate reconnection
      const panelClient2 = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        readyMode: 'auto',
        channel: panelChannel,
        isLeader: true,
      });

      // Wait for handshake to complete with the new panel client
      await new Promise<void>((resolve) => {
        if (panelClient2.isReady()) {
          resolve();
        } else {
          panelClient2.onReady(() => resolve());
        }
      });

      // Both should be ready now
      expect(panelClient2.isReady()).toBe(true);
      expect(deviceClient.isReady()).toBe(true);

      // Test that messages flow correctly
      const messages: Array<{ message: string }> = [];
      panelClient2.onMessage('test-event', (payload: { message: string }) => {
        messages.push(payload);
      });

      deviceClient.send('test-event', { message: 'after reload' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ message: 'after reload' });

      deviceClient.close();
      panelClient2.close();
    });
  });
});