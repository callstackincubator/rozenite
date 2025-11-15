import { NetworkActivityDevToolsClient, NetworkActivityEventMap } from '../../shared/client';

type QueuedMessage<K extends keyof NetworkActivityEventMap = keyof NetworkActivityEventMap> = {
  type: K;
  data: NetworkActivityEventMap[K];
};

/**
 * Wraps a client to queue messages until the client is available
 */
export class QueuedClientWrapper {
  private messageQueue: QueuedMessage[] = [];
  private actualClient: NetworkActivityDevToolsClient | null = null;
  private maxQueueSize = 200;

  constructor() {
    console.log('[QueuedClientWrapper] Initialized');
  }

  /**
   * Set the actual client and flush the queue
   */
  public setClient(client: NetworkActivityDevToolsClient): void {
    console.log('[QueuedClientWrapper] Client connected, flushing queue');
    this.actualClient = client;
    this.flushQueue();
  }

  /**
   * Send a message (queued if client not available)
   */
  public send<K extends keyof NetworkActivityEventMap>(
    type: K,
    data: NetworkActivityEventMap[K]
  ): void {
    if (this.actualClient) {
      // Client available, send directly
      console.log(`[QueuedClientWrapper] Sending ${type} directly (client available)`);
      this.actualClient.send(type, data);
    } else {
      // Queue the message
      console.log(`[QueuedClientWrapper] Queuing ${type} (client not available)`);
      this.enqueueMessage({ type, data });
    }
  }

  /**
   * Queue a message
   */
  private enqueueMessage(message: QueuedMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      console.warn('[QueuedClientWrapper] Queue full, dropping oldest message');
      this.messageQueue.shift();
    }
    
    this.messageQueue.push(message);
    console.log(`[QueuedClientWrapper] Queued ${message.type}, queue size: ${this.messageQueue.length}`);
  }

  /**
   * Flush all queued messages
   */
  private flushQueue(): void {
    if (!this.actualClient) {
      return;
    }

    console.log(`[QueuedClientWrapper] Flushing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        // Type assertion is safe here because we're just forwarding the queued message
        this.actualClient.send(message.type, message.data);
      }
    }
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Check if client is available
   */
  public hasClient(): boolean {
    return this.actualClient !== null;
  }
}

// Global singleton
declare global {
  var __rozeniteQueuedClientWrapper: QueuedClientWrapper | undefined;
}

export const getQueuedClientWrapper = (): QueuedClientWrapper => {
  if (!global.__rozeniteQueuedClientWrapper) {
    console.log('[QueuedClientWrapper] Creating new singleton');
    global.__rozeniteQueuedClientWrapper = new QueuedClientWrapper();
  } else {
    console.log('[QueuedClientWrapper] Reusing existing singleton');
  }
  return global.__rozeniteQueuedClientWrapper;
};
