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
  private bootInterceptionEnabled = false;

  public setClient(client: NetworkActivityDevToolsClient): void {
    this.actualClient = client;
  }

  public enableBootInterception(): void {
    this.bootInterceptionEnabled = true;
  }

  public disableBootInterception(): void {
    this.bootInterceptionEnabled = false;
  }

  public isBootInterceptionEnabled(): boolean {
    return this.bootInterceptionEnabled;
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
      this.actualClient.send(type, data);
    } else {
      // Queue the message
      this.enqueueMessage({ type, data });
    }
  }

  private enqueueMessage(message: QueuedMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    
    this.messageQueue.push(message);
  }

  public flushQueue(): void {
    if (!this.actualClient) {
      return;
    }
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        // Type assertion is safe here because we're just forwarding the queued message
        this.actualClient.send(message.type, message.data);
      }
    }
  }
}

// Global singleton
declare global {
  var __rozeniteQueuedClientWrapper: QueuedClientWrapper | undefined;
}

export const getQueuedClientWrapper = (): QueuedClientWrapper => {
  if (!global.__rozeniteQueuedClientWrapper) {
    global.__rozeniteQueuedClientWrapper = new QueuedClientWrapper();
  }
  return global.__rozeniteQueuedClientWrapper;
};
