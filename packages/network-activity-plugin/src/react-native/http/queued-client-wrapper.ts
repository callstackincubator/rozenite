import { NetworkActivityDevToolsClient, NetworkActivityEventMap } from '../../shared/client';

type QueuedMessage<K extends keyof NetworkActivityEventMap = keyof NetworkActivityEventMap> = {
  type: K;
  data: NetworkActivityEventMap[K];
};

/**
 * Wraps a client to queue messages until the client is available.
 * This allows capturing network events before the DevTools client connects.
 */
export class QueuedClientWrapper {
  private messageQueue: QueuedMessage[] = [];
  private actualClient: NetworkActivityDevToolsClient | null = null;
  private maxQueueSize = 200;

  constructor() {
    // Initialized
  }

  /**
   * Set the actual client (does not flush the queue)
   */
  public setClient(client: NetworkActivityDevToolsClient): void {
    console.log('[QueuedClientWrapper] setClient called, current queue size:', this.messageQueue.length);
    this.actualClient = client;
  }

  /**
   * Flush the queue manually
   */
  public flush(): void {
    console.log('[QueuedClientWrapper] flush() called, queue size:', this.messageQueue.length);
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
      console.log('[QueuedClientWrapper] Sending message directly:', type);
      this.actualClient.send(type, data);
    } else {
      // Queue the message
      console.log('[QueuedClientWrapper] Queueing message:', type);
      this.enqueueMessage({ type, data });
    }
  }

  /**
   * Queue a message
   */
  private enqueueMessage(message: QueuedMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    
    this.messageQueue.push(message);
  }

  /**
   * Flush all queued messages
   */
  private flushQueue(): void {
    if (!this.actualClient) {
      console.log('[QueuedClientWrapper] Cannot flush - no client available');
      return;
    }
    
    console.log('[QueuedClientWrapper] Flushing', this.messageQueue.length, 'messages');
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        console.log('[QueuedClientWrapper] Flushing message:', message.type);
        // Type assertion is safe here because we're just forwarding the queued message
        this.actualClient.send(message.type, message.data);
      }
    }
    console.log('[QueuedClientWrapper] Flush complete');
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
    console.log('[QueuedClientWrapper] Creating new global instance');
    global.__rozeniteQueuedClientWrapper = new QueuedClientWrapper();
  } else {
    console.log('[QueuedClientWrapper] Using existing global instance');
  }
  return global.__rozeniteQueuedClientWrapper;
};
