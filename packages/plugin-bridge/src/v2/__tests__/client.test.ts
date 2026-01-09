import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '../client/factory.js';
import { RozeniteDevToolsClient } from '../client/types.js';
import { UserMessage } from '../connection/types.js';
import {
  createMockChannelPair,
  wait,
  waitForBothReady,
  MockChannel,
} from '../test-utils/index.js';

type TestEventMap = {
  'test-event': { message: string };
  'another-event': { count: number };
  'ping': { id: number };
  'pong': { id: number };
  'batch': { index: number };
};

describe('Plugin Bridge v2 - Client E2E Tests', () => {
  let deviceChannel: MockChannel;
  let panelChannel: MockChannel;

  beforeEach(() => {
    [deviceChannel, panelChannel] = createMockChannelPair();
  });

  describe('Basic messaging', () => {
    it('should complete handshake automatically', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      await waitForBothReady(deviceClient, panelClient);

      expect(deviceClient.isReady()).toBe(true);
      expect(panelClient.isReady()).toBe(true);

      deviceClient.close();
      panelClient.close();
    });

    it('should send and receive messages with timestamp and data', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      const deviceMessages: UserMessage<{ message: string }>[] = [];
      const panelMessages: UserMessage<{ message: string }>[] = [];

      deviceClient.onMessage('test-event', (msg) => {
        deviceMessages.push(msg);
      });

      panelClient.onMessage('test-event', (msg) => {
        panelMessages.push(msg);
      });

      await waitForBothReady(deviceClient, panelClient);

      const beforeSend = Date.now();
      panelClient.send('test-event', { message: 'from panel' });
      deviceClient.send('test-event', { message: 'from device' });

      await wait(50);

      expect(deviceMessages).toHaveLength(1);
      expect(deviceMessages[0].data).toEqual({ message: 'from panel' });
      expect(deviceMessages[0].timestamp).toBeGreaterThanOrEqual(beforeSend);
      expect(deviceMessages[0].type).toBe('test-event');

      expect(panelMessages).toHaveLength(1);
      expect(panelMessages[0].data).toEqual({ message: 'from device' });
      expect(panelMessages[0].timestamp).toBeGreaterThanOrEqual(beforeSend);

      deviceClient.close();
      panelClient.close();
    });

    it('should filter messages by type', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      const testEvents: UserMessage[] = [];
      const anotherEvents: UserMessage[] = [];

      deviceClient.onMessage('test-event', (msg) => testEvents.push(msg));
      deviceClient.onMessage('another-event', (msg) => anotherEvents.push(msg));
      panelClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient);

      panelClient.send('test-event', { message: 'hello' });
      panelClient.send('another-event', { count: 42 });
      panelClient.send('test-event', { message: 'world' });

      await wait(50);

      expect(testEvents).toHaveLength(2);
      expect(testEvents[0].data).toEqual({ message: 'hello' });
      expect(testEvents[1].data).toEqual({ message: 'world' });

      expect(anotherEvents).toHaveLength(1);
      expect(anotherEvents[0].data).toEqual({ count: 42 });

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Per-type buffering and replay', () => {
    it('should buffer messages until handler is registered', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      // Panel registers handler to trigger handshake on that side
      panelClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient);

      // Send messages BEFORE device registers handler
      panelClient.send('test-event', { message: 'early 1' });
      panelClient.send('test-event', { message: 'early 2' });

      await wait(50);

      // Now register handler - should get replay
      const receivedMessages: UserMessage<{ message: string }>[] = [];
      deviceClient.onMessage('test-event', (msg) => {
        receivedMessages.push(msg);
      });

      await wait(50);

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0].data).toEqual({ message: 'early 1' });
      expect(receivedMessages[1].data).toEqual({ message: 'early 2' });

      deviceClient.close();
      panelClient.close();
    });

    it('should replay only to first handler, not subsequent ones', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      panelClient.onMessage('test-event', () => {});
      await waitForBothReady(deviceClient, panelClient);

      // Send before any device handler
      panelClient.send('test-event', { message: 'buffered' });
      await wait(50);

      const handler1Messages: UserMessage[] = [];
      const handler2Messages: UserMessage[] = [];

      // First handler gets replay
      deviceClient.onMessage('test-event', (msg) => handler1Messages.push(msg));
      await wait(50);

      // Second handler does NOT get replay
      deviceClient.onMessage('test-event', (msg) => handler2Messages.push(msg));
      await wait(50);

      expect(handler1Messages).toHaveLength(1);
      expect(handler2Messages).toHaveLength(0);

      // New message goes to both
      panelClient.send('test-event', { message: 'new' });
      await wait(50);

      expect(handler1Messages).toHaveLength(2);
      expect(handler2Messages).toHaveLength(1);

      deviceClient.close();
      panelClient.close();
    });

    it('should buffer different message types independently', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      panelClient.onMessage('test-event', () => {});
      panelClient.onMessage('another-event', () => {});
      await waitForBothReady(deviceClient, panelClient);

      // Send different types before device handlers
      panelClient.send('test-event', { message: 'test msg' });
      panelClient.send('another-event', { count: 42 });
      await wait(50);

      const testMessages: UserMessage[] = [];
      const anotherMessages: UserMessage[] = [];

      // Register test-event handler - should only replay test-event
      deviceClient.onMessage('test-event', (msg) => testMessages.push(msg));
      await wait(50);

      expect(testMessages).toHaveLength(1);
      expect(anotherMessages).toHaveLength(0);

      // Register another-event handler - should only replay another-event
      deviceClient.onMessage('another-event', (msg) => anotherMessages.push(msg));
      await wait(50);

      expect(testMessages).toHaveLength(1);
      expect(anotherMessages).toHaveLength(1);

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Handshake protocol', () => {
    it('should follow INIT -> ACK -> COMPLETE sequence', async () => {
      const handshakeSequence: string[] = [];

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
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      await waitForBothReady(deviceClient, panelClient);

      expect(handshakeSequence).toEqual([
        'panel:__HANDSHAKE_INIT__',
        'device:__HANDSHAKE_ACK__',
        'panel:__HANDSHAKE_COMPLETE__',
      ]);

      deviceClient.close();
      panelClient.close();
    });

    it('should isolate messages by pluginId', async () => {
      const plugin1Device = await createClient<TestEventMap>({
        pluginId: 'plugin-1',
        channel: deviceChannel,
        isLeader: false,
      });

      const plugin1Panel = await createClient<TestEventMap>({
        pluginId: 'plugin-1',
        channel: panelChannel,
        isLeader: true,
      });

      const plugin2Device = await createClient<TestEventMap>({
        pluginId: 'plugin-2',
        channel: deviceChannel,
        isLeader: false,
      });

      const plugin2Panel = await createClient<TestEventMap>({
        pluginId: 'plugin-2',
        channel: panelChannel,
        isLeader: true,
      });

      const plugin1Messages: UserMessage[] = [];
      const plugin2Messages: UserMessage[] = [];

      plugin1Device.onMessage('test-event', (msg) => plugin1Messages.push(msg));
      plugin2Device.onMessage('test-event', (msg) => plugin2Messages.push(msg));
      plugin1Panel.onMessage('test-event', () => {});
      plugin2Panel.onMessage('test-event', () => {});

      await waitForBothReady(plugin1Device, plugin1Panel);
      await waitForBothReady(plugin2Device, plugin2Panel);

      plugin1Panel.send('test-event', { message: 'for plugin 1' });
      plugin2Panel.send('test-event', { message: 'for plugin 2' });

      await wait(50);

      expect(plugin1Messages).toHaveLength(1);
      expect(plugin1Messages[0].data).toEqual({ message: 'for plugin 1' });

      expect(plugin2Messages).toHaveLength(1);
      expect(plugin2Messages[0].data).toEqual({ message: 'for plugin 2' });

      plugin1Device.close();
      plugin1Panel.close();
      plugin2Device.close();
      plugin2Panel.close();
    });
  });

  describe('Reconnection', () => {
    it('should handle DevTools UI reload', async () => {
      const [panelChannel, deviceChannel] = createMockChannelPair();

      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient1 = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      panelClient1.onMessage('test-event', () => {});
      deviceClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient1);

      // Close first panel (simulate reload)
      panelClient1.close();

      // New panel connects
      const panelClient2 = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      const messages: UserMessage[] = [];
      panelClient2.onMessage('test-event', (msg) => messages.push(msg));

      await waitForBothReady(deviceClient, panelClient2);

      deviceClient.send('test-event', { message: 'after reload' });
      await wait(50);

      expect(messages).toHaveLength(1);
      expect(messages[0].data).toEqual({ message: 'after reload' });

      deviceClient.close();
      panelClient2.close();
    });
  });

  describe('High-volume messaging', () => {
    it('should handle large batches of messages', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      panelClient.onMessage('batch', () => {});

      await waitForBothReady(deviceClient, panelClient);

      const MESSAGE_COUNT = 100;
      const receivedMessages: UserMessage<{ index: number }>[] = [];

      deviceClient.onMessage('batch', (msg) => receivedMessages.push(msg));

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        panelClient.send('batch', { index: i });
      }

      await wait(200);

      expect(receivedMessages).toHaveLength(MESSAGE_COUNT);

      // Verify order is preserved
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        expect(receivedMessages[i].data.index).toBe(i);
      }

      deviceClient.close();
      panelClient.close();
    });

    it('should respect buffer limits', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
        buffer: { maxPerType: 10 },
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      panelClient.onMessage('batch', () => {});
      await waitForBothReady(deviceClient, panelClient);

      // Send 50 messages before handler is registered on device
      for (let i = 0; i < 50; i++) {
        panelClient.send('batch', { index: i });
      }

      await wait(100);

      // Now register handler
      const receivedMessages: UserMessage<{ index: number }>[] = [];
      deviceClient.onMessage('batch', (msg) => receivedMessages.push(msg));

      await wait(50);

      // Should only have last 10 (maxPerType)
      expect(receivedMessages.length).toBeLessThanOrEqual(10);

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Bidirectional communication', () => {
    it('should support ping-pong pattern', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      // Device responds to ping with pong
      deviceClient.onMessage('ping', (msg) => {
        deviceClient.send('pong', { id: msg.data.id });
      });

      panelClient.onMessage('ping', () => {});

      await waitForBothReady(deviceClient, panelClient);

      const pongReceived = new Promise<number>((resolve) => {
        panelClient.onMessage('pong', (msg) => resolve(msg.data.id));
      });

      panelClient.send('ping', { id: 42 });

      const result = await pongReceived;
      expect(result).toBe(42);

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Handler management', () => {
    it('should handle multiple handlers for the same type', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      const handler1Messages: UserMessage[] = [];
      const handler2Messages: UserMessage[] = [];

      deviceClient.onMessage('test-event', (msg) => handler1Messages.push(msg));
      deviceClient.onMessage('test-event', (msg) => handler2Messages.push(msg));
      panelClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient);

      panelClient.send('test-event', { message: 'broadcast' });
      await wait(50);

      expect(handler1Messages).toHaveLength(1);
      expect(handler2Messages).toHaveLength(1);

      deviceClient.close();
      panelClient.close();
    });

    it('should handle listener removal', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      const messages: UserMessage[] = [];

      const subscription = deviceClient.onMessage('test-event', (msg) => {
        messages.push(msg);
      });

      panelClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient);

      panelClient.send('test-event', { message: 'first' });
      await wait(50);

      subscription.remove();

      panelClient.send('test-event', { message: 'second' });
      await wait(50);

      expect(messages).toHaveLength(1);

      deviceClient.close();
      panelClient.close();
    });
  });

  describe('Edge cases', () => {
    it('should handle close gracefully', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      deviceClient.close();
      panelClient.close();

      expect(deviceClient.isReady()).toBe(false);
    });

    it('should handle onReady callback when already ready', async () => {
      const deviceClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: deviceChannel,
        isLeader: false,
      });

      const panelClient = await createClient<TestEventMap>({
        pluginId: 'test-plugin',
        channel: panelChannel,
        isLeader: true,
      });

      deviceClient.onMessage('test-event', () => {});
      panelClient.onMessage('test-event', () => {});

      await waitForBothReady(deviceClient, panelClient);

      const readyCallback = vi.fn();
      deviceClient.onReady(readyCallback);

      await wait(20);

      expect(readyCallback).toHaveBeenCalledTimes(1);

      deviceClient.close();
      panelClient.close();
    });
  });
});
