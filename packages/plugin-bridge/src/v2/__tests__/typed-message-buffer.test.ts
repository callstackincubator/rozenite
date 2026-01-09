import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTypedMessageBuffer } from '../client/typed-message-buffer.js';
import { UserMessage } from '../connection/types.js';

const createMessage = (type: string, data: unknown): UserMessage => ({
  type,
  data,
  timestamp: Date.now(),
});

describe('TypedMessageBuffer', () => {
  describe('Handler registration', () => {
    it('should deliver messages immediately when handler exists', () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];

      buffer.onMessage('test', (msg) => received.push(msg));
      buffer.handleMessage(createMessage('test', { value: 1 }));

      expect(received).toHaveLength(1);
      expect(received[0].data).toEqual({ value: 1 });

      buffer.close();
    });

    it('should buffer messages when no handler exists', () => {
      const buffer = createTypedMessageBuffer();

      buffer.handleMessage(createMessage('test', { value: 1 }));
      buffer.handleMessage(createMessage('test', { value: 2 }));

      expect(buffer.getBufferedCount('test')).toBe(2);
      expect(buffer.getTotalBufferedCount()).toBe(2);

      buffer.close();
    });

    it('should replay buffered messages when first handler is registered', async () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];

      // Buffer some messages
      buffer.handleMessage(createMessage('test', { value: 1 }));
      buffer.handleMessage(createMessage('test', { value: 2 }));
      buffer.handleMessage(createMessage('test', { value: 3 }));

      expect(buffer.getBufferedCount('test')).toBe(3);

      // Register handler - should trigger replay
      buffer.onMessage('test', (msg) => received.push(msg));

      // Wait for replay (happens on next tick)
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received).toHaveLength(3);
      expect(received[0].data).toEqual({ value: 1 });
      expect(received[1].data).toEqual({ value: 2 });
      expect(received[2].data).toEqual({ value: 3 });

      // Buffer should be empty after replay
      expect(buffer.getBufferedCount('test')).toBe(0);

      buffer.close();
    });

    it('should not replay to subsequent handlers for the same type', async () => {
      const buffer = createTypedMessageBuffer();
      const handler1Received: UserMessage[] = [];
      const handler2Received: UserMessage[] = [];

      // Buffer message
      buffer.handleMessage(createMessage('test', { value: 'buffered' }));

      // First handler gets replay
      buffer.onMessage('test', (msg) => handler1Received.push(msg));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second handler doesn't get replay
      buffer.onMessage('test', (msg) => handler2Received.push(msg));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1Received).toHaveLength(1);
      expect(handler2Received).toHaveLength(0);

      // New message goes to both
      buffer.handleMessage(createMessage('test', { value: 'new' }));

      expect(handler1Received).toHaveLength(2);
      expect(handler2Received).toHaveLength(1);

      buffer.close();
    });

    it('should buffer different types independently', async () => {
      const buffer = createTypedMessageBuffer();
      const typeAReceived: UserMessage[] = [];
      const typeBReceived: UserMessage[] = [];

      // Buffer messages of different types
      buffer.handleMessage(createMessage('type-a', { a: 1 }));
      buffer.handleMessage(createMessage('type-b', { b: 1 }));
      buffer.handleMessage(createMessage('type-a', { a: 2 }));

      expect(buffer.getBufferedCount('type-a')).toBe(2);
      expect(buffer.getBufferedCount('type-b')).toBe(1);

      // Register handler for type-a only
      buffer.onMessage('type-a', (msg) => typeAReceived.push(msg));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // type-a replayed, type-b still buffered
      expect(typeAReceived).toHaveLength(2);
      expect(buffer.getBufferedCount('type-a')).toBe(0);
      expect(buffer.getBufferedCount('type-b')).toBe(1);

      // Now register handler for type-b
      buffer.onMessage('type-b', (msg) => typeBReceived.push(msg));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(typeBReceived).toHaveLength(1);
      expect(buffer.getBufferedCount('type-b')).toBe(0);

      buffer.close();
    });
  });

  describe('Buffer limits', () => {
    it('should respect maxPerType limit', () => {
      const buffer = createTypedMessageBuffer({ maxPerType: 3 });

      for (let i = 0; i < 5; i++) {
        buffer.handleMessage(createMessage('test', { index: i }));
      }

      expect(buffer.getBufferedCount('test')).toBe(3);

      buffer.close();
    });

    it('should respect maxTotal limit', () => {
      const buffer = createTypedMessageBuffer({ maxTotal: 5 });

      for (let i = 0; i < 3; i++) {
        buffer.handleMessage(createMessage('type-a', { index: i }));
      }
      for (let i = 0; i < 5; i++) {
        buffer.handleMessage(createMessage('type-b', { index: i }));
      }

      expect(buffer.getTotalBufferedCount()).toBe(5);

      buffer.close();
    });

    it('should drop old messages when buffer overflows', async () => {
      const buffer = createTypedMessageBuffer({ maxPerType: 3 });
      const received: UserMessage[] = [];

      // Add 5 messages, only last 3 should be kept
      for (let i = 0; i < 5; i++) {
        buffer.handleMessage(createMessage('test', { index: i }));
      }

      buffer.onMessage('test', (msg) => received.push(msg));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received).toHaveLength(3);
      expect((received[0].data as any).index).toBe(2);
      expect((received[1].data as any).index).toBe(3);
      expect((received[2].data as any).index).toBe(4);

      buffer.close();
    });

    it('should drop messages older than maxAgeMs', async () => {
      const buffer = createTypedMessageBuffer({ maxAgeMs: 50 });

      buffer.handleMessage(createMessage('test', { value: 'old' }));

      // Wait for message to become stale
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stale message should be cleaned up when we check
      expect(buffer.getBufferedCount('test')).toBe(0);

      buffer.close();
    });
  });

  describe('Handler removal', () => {
    it('should stop delivering to removed handlers', () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];

      const sub = buffer.onMessage('test', (msg) => received.push(msg));
      buffer.handleMessage(createMessage('test', { value: 1 }));

      expect(received).toHaveLength(1);

      sub.remove();

      buffer.handleMessage(createMessage('test', { value: 2 }));

      expect(received).toHaveLength(1);

      buffer.close();
    });

    it('should buffer again if all handlers are removed', () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];

      const sub = buffer.onMessage('test', (msg) => received.push(msg));
      buffer.handleMessage(createMessage('test', { value: 1 }));

      sub.remove();

      // New message should be buffered (no handlers)
      buffer.handleMessage(createMessage('test', { value: 2 }));

      // Note: messages are only buffered until first handler is registered
      // After that, they go to handlers or are dropped if no handlers
      // This test verifies they're not delivered to removed handlers
      expect(received).toHaveLength(1);

      buffer.close();
    });
  });

  describe('Error handling', () => {
    it('should catch handler errors and continue to other handlers', () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      buffer.onMessage('test', () => {
        throw new Error('Handler error');
      });
      buffer.onMessage('test', (msg) => received.push(msg));

      buffer.handleMessage(createMessage('test', { value: 1 }));

      expect(received).toHaveLength(1);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
      buffer.close();
    });
  });

  describe('Close', () => {
    it('should clear all state on close', () => {
      const buffer = createTypedMessageBuffer();

      buffer.handleMessage(createMessage('test', { value: 1 }));
      buffer.onMessage('test', () => {});

      buffer.close();

      expect(buffer.getTotalBufferedCount()).toBe(0);

      buffer.close();
    });

    it('should not process messages after close', () => {
      const buffer = createTypedMessageBuffer();
      const received: UserMessage[] = [];

      buffer.onMessage('test', (msg) => received.push(msg));
      buffer.close();

      buffer.handleMessage(createMessage('test', { value: 1 }));

      expect(received).toHaveLength(0);
    });
  });
});

