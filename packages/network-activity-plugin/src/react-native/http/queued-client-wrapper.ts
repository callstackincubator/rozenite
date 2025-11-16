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
  private enqueueMessages = false;
  

  public setClient(client: NetworkActivityDevToolsClient): void {
    this.actualClient = client;
  }

  public setMaxQueueSize(size: number): void {
    this.maxQueueSize = size;
  }

  public enableBootInterception(): void {
    this.enqueueMessages = true;
  }

  public enableClient(): void {
    this.enqueueMessages = false;
  }

  public isBootInterceptionEnabled(): boolean {
    return this.enqueueMessages;
  }

  /**
   * Send a message (queued if client not available)
   */
  public send<K extends keyof NetworkActivityEventMap>(
    type: K,
    data: NetworkActivityEventMap[K]
  ): void {
    if (!this.enqueueMessages && this.actualClient) {
      this.actualClient.send(type, data);
    } else {
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
        this.actualClient.send(message.type, message.data);
      }
    }
  }
}

declare global {
  var __rozeniteQueuedClientWrapper: QueuedClientWrapper | undefined;
}

export type QueuedClientOptions = {
  maxQueueSize?: number;
};

export const getQueuedClientWrapper = (options?: QueuedClientOptions): QueuedClientWrapper => {
  if (!global.__rozeniteQueuedClientWrapper) {
    global.__rozeniteQueuedClientWrapper = new QueuedClientWrapper();
  }
  
  if (options?.maxQueueSize !== undefined) {
    global.__rozeniteQueuedClientWrapper.setMaxQueueSize(options.maxQueueSize);
  }
  
  return global.__rozeniteQueuedClientWrapper;
};
