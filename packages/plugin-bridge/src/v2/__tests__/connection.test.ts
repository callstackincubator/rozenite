import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHandshakeConnection } from '../connection/handshake-connection.js';
import { createBufferedConnection } from '../connection/buffered-connection.js';
import {
  HANDSHAKE_INIT,
  HANDSHAKE_ACK,
  HANDSHAKE_COMPLETE,
  WireMessage,
} from '../connection/types.js';
import {
  createMockChannelPair,
  wait,
  waitFor,
  MockChannel,
} from '../test-utils/index.js';

const createWireMessage = (pluginId: string, type: string, data: unknown): WireMessage => ({
  pluginId,
  type,
  timestamp: Date.now(),
  data,
});

describe('Connection Layer', () => {
  let channelA: MockChannel;
  let channelB: MockChannel;

  beforeEach(() => {
    [channelA, channelB] = createMockChannelPair();
  });

  describe('HandshakeConnection', () => {
    describe('Handshake Protocol', () => {
      it('should complete handshake with INIT -> ACK -> COMPLETE sequence', async () => {
        const handshakeMessages: string[] = [];

        const originalSendA = channelA.send.bind(channelA);
        const originalSendB = channelB.send.bind(channelB);

        channelA.send = vi.fn((msg: unknown) => {
          const message = msg as Record<string, unknown>;
          if (typeof message.type === 'string' && message.type.startsWith('__HANDSHAKE_')) {
            handshakeMessages.push(`A:${message.type}`);
          }
          originalSendA(msg);
        });

        channelB.send = vi.fn((msg: unknown) => {
          const message = msg as Record<string, unknown>;
          if (typeof message.type === 'string' && message.type.startsWith('__HANDSHAKE_')) {
            handshakeMessages.push(`B:${message.type}`);
          }
          originalSendB(msg);
        });

        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        await waitFor(() => leaderConnection.isReady() && followerConnection.isReady());

        expect(handshakeMessages).toEqual([
          `A:${HANDSHAKE_INIT}`,
          `B:${HANDSHAKE_ACK}`,
          `A:${HANDSHAKE_COMPLETE}`,
        ]);

        leaderConnection.close();
        followerConnection.close();
      });

      it('should report isReady() correctly throughout handshake', async () => {
        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        expect(leaderConnection.isReady()).toBe(false);

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        expect(followerConnection.isReady()).toBe(false);

        await waitFor(() => leaderConnection.isReady() && followerConnection.isReady());

        expect(leaderConnection.isReady()).toBe(true);
        expect(followerConnection.isReady()).toBe(true);

        leaderConnection.close();
        followerConnection.close();
      });

      it('should call onReady callbacks when handshake completes', async () => {
        const leaderReadyCallback = vi.fn();
        const followerReadyCallback = vi.fn();

        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        leaderConnection.onReady(leaderReadyCallback);
        followerConnection.onReady(followerReadyCallback);

        await waitFor(() => leaderConnection.isReady() && followerConnection.isReady());
        await wait(10);

        expect(leaderReadyCallback).toHaveBeenCalledTimes(1);
        expect(followerReadyCallback).toHaveBeenCalledTimes(1);

        leaderConnection.close();
        followerConnection.close();
      });

      it('should call onReady immediately if already ready', async () => {
        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        await waitFor(() => leaderConnection.isReady());

        const lateCallback = vi.fn();
        leaderConnection.onReady(lateCallback);

        await wait(10);
        expect(lateCallback).toHaveBeenCalledTimes(1);

        leaderConnection.close();
        followerConnection.close();
      });
    });

    describe('Message Routing', () => {
      it('should forward wire messages to listeners', async () => {
        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const receivedMessages: WireMessage[] = [];
        followerConnection.onMessage((msg) => {
          receivedMessages.push(msg as WireMessage);
        });

        await waitFor(() => leaderConnection.isReady() && followerConnection.isReady());

        const wireMsg = createWireMessage('test', 'test-event', { hello: 'world' });
        leaderConnection.send(wireMsg);

        await wait(20);

        expect(receivedMessages).toHaveLength(1);
        expect(receivedMessages[0].type).toBe('test-event');
        expect(receivedMessages[0].data).toEqual({ hello: 'world' });
        expect(receivedMessages[0].timestamp).toBeDefined();

        leaderConnection.close();
        followerConnection.close();
      });

      it('should filter messages by pluginId', async () => {
        const connectionA1 = createHandshakeConnection(channelA, {
          pluginId: 'plugin-1',
          isLeader: true,
        });

        const connectionB1 = createHandshakeConnection(channelB, {
          pluginId: 'plugin-1',
          isLeader: false,
        });

        const connectionA2 = createHandshakeConnection(channelA, {
          pluginId: 'plugin-2',
          isLeader: true,
        });

        const connectionB2 = createHandshakeConnection(channelB, {
          pluginId: 'plugin-2',
          isLeader: false,
        });

        const plugin1Messages: WireMessage[] = [];
        const plugin2Messages: WireMessage[] = [];

        connectionB1.onMessage((msg) => plugin1Messages.push(msg as WireMessage));
        connectionB2.onMessage((msg) => plugin2Messages.push(msg as WireMessage));

        await waitFor(() => connectionA1.isReady() && connectionB1.isReady());
        await waitFor(() => connectionA2.isReady() && connectionB2.isReady());

        connectionA1.send(createWireMessage('plugin-1', 'event', 'for plugin 1'));
        connectionA2.send(createWireMessage('plugin-2', 'event', 'for plugin 2'));

        await wait(20);

        expect(plugin1Messages).toHaveLength(1);
        expect(plugin1Messages[0].data).toBe('for plugin 1');

        expect(plugin2Messages).toHaveLength(1);
        expect(plugin2Messages[0].data).toBe('for plugin 2');

        connectionA1.close();
        connectionB1.close();
        connectionA2.close();
        connectionB2.close();
      });
    });

    describe('Reconnection', () => {
      it('should handle leader reconnection (DevTools reload)', async () => {
        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const leaderConnection1 = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        await waitFor(() => leaderConnection1.isReady() && followerConnection.isReady());
        expect(followerConnection.isReady()).toBe(true);

        leaderConnection1.close();

        const leaderConnection2 = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        await waitFor(() => leaderConnection2.isReady());

        expect(leaderConnection2.isReady()).toBe(true);
        expect(followerConnection.isReady()).toBe(true);

        const messages: WireMessage[] = [];
        leaderConnection2.onMessage((msg) => messages.push(msg as WireMessage));

        followerConnection.send(createWireMessage('test', 'test', 'after reconnect'));

        await wait(20);
        expect(messages).toHaveLength(1);

        leaderConnection2.close();
        followerConnection.close();
      });
    });

    describe('Manual start', () => {
      it('should not start handshake when autoStart is false', async () => {
        const leaderConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
          autoStart: false,
        });

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
          autoStart: false,
        });

        await wait(50);

        expect(leaderConnection.isReady()).toBe(false);
        expect(followerConnection.isReady()).toBe(false);

        // Manually start
        leaderConnection.signalReady();

        await waitFor(() => leaderConnection.isReady() && followerConnection.isReady());

        expect(leaderConnection.isReady()).toBe(true);
        expect(followerConnection.isReady()).toBe(true);

        leaderConnection.close();
        followerConnection.close();
      });
    });
  });

  describe('BufferedConnection', () => {
    describe('Message Queuing', () => {
      it('should queue outgoing messages until ready', async () => {
        const handshakeConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const bufferedConnection = createBufferedConnection(handshakeConnection);

        // Send before ready
        bufferedConnection.send(createWireMessage('test', 'early', 1));
        bufferedConnection.send(createWireMessage('test', 'early', 2));

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const receivedMessages: WireMessage[] = [];
        followerConnection.onMessage((msg) => receivedMessages.push(msg as WireMessage));

        await waitFor(() => handshakeConnection.isReady() && followerConnection.isReady());
        await wait(20);

        expect(receivedMessages).toHaveLength(2);
        expect(receivedMessages[0].data).toBe(1);
        expect(receivedMessages[1].data).toBe(2);

        bufferedConnection.close();
        followerConnection.close();
      });

      it('should respect maxQueueSize and drop oldest on overflow', async () => {
        const handshakeConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const bufferedConnection = createBufferedConnection(handshakeConnection, {
          maxQueueSize: 3,
          overflowStrategy: 'drop-oldest',
        });

        for (let i = 1; i <= 5; i++) {
          bufferedConnection.send(createWireMessage('test', 'msg', i));
        }

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const receivedMessages: WireMessage[] = [];
        followerConnection.onMessage((msg) => receivedMessages.push(msg as WireMessage));

        await waitFor(() => handshakeConnection.isReady());
        await wait(20);

        expect(receivedMessages).toHaveLength(3);
        expect(receivedMessages[0].data).toBe(3);
        expect(receivedMessages[1].data).toBe(4);
        expect(receivedMessages[2].data).toBe(5);

        bufferedConnection.close();
        followerConnection.close();
      });

      it('should drop newest on overflow when configured', async () => {
        const handshakeConnection = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });

        const bufferedConnection = createBufferedConnection(handshakeConnection, {
          maxQueueSize: 3,
          overflowStrategy: 'drop-newest',
        });

        for (let i = 1; i <= 5; i++) {
          bufferedConnection.send(createWireMessage('test', 'msg', i));
        }

        const followerConnection = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const receivedMessages: WireMessage[] = [];
        followerConnection.onMessage((msg) => receivedMessages.push(msg as WireMessage));

        await waitFor(() => handshakeConnection.isReady());
        await wait(20);

        expect(receivedMessages).toHaveLength(3);
        expect(receivedMessages[0].data).toBe(1);
        expect(receivedMessages[1].data).toBe(2);
        expect(receivedMessages[2].data).toBe(3);

        bufferedConnection.close();
        followerConnection.close();
      });
    });

    describe('Passthrough when ready', () => {
      it('should send messages immediately when ready', async () => {
        const leaderHandshake = createHandshakeConnection(channelA, {
          pluginId: 'test',
          isLeader: true,
        });
        const leaderBuffered = createBufferedConnection(leaderHandshake);

        const followerHandshake = createHandshakeConnection(channelB, {
          pluginId: 'test',
          isLeader: false,
        });

        const receivedMessages: WireMessage[] = [];
        followerHandshake.onMessage((msg) => receivedMessages.push(msg as WireMessage));

        await waitFor(() => leaderBuffered.isReady());

        leaderBuffered.send(createWireMessage('test', 'immediate', 'now'));

        await wait(20);

        expect(receivedMessages).toHaveLength(1);
        expect(receivedMessages[0].data).toBe('now');

        leaderBuffered.close();
        followerHandshake.close();
      });
    });
  });
});
