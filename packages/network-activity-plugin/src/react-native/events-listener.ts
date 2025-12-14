type QueuedMessage<TEventMap extends Record<string, unknown>> = {
  type: keyof TEventMap;
  data: TEventMap[keyof TEventMap];
};

type SendFunction<TEventMap extends Record<string, unknown>> = <
  K extends keyof TEventMap,
>(
  type: K,
  data: TEventMap[K],
) => void;

/**
 * Generic events listener that queues messages until a send function is registered.
 * This allows capturing events before the DevTools client connects and so be boot compliant.
 * Can be used for HTTP, WebSocket, SSE, or any other event type.
 */
export class EventsListener<TEventMap extends Record<string, unknown>> {
  private messageQueue: QueuedMessage<TEventMap>[] = [];
  private sendFunction: SendFunction<TEventMap> | null = null;
  private maxQueueSize = 200;
  private isQueuing = true; // Start in queuing mode by default

  public setMaxQueueSize(size: number): void {
    this.maxQueueSize = size;
  }

  /**
   * Enable queuing mode to capture events before client is connected
   */
  public enableQueuing(): void {
    this.isQueuing = true;
  }

  /**
   * Connect the actual send function and automatically flush queued messages
   */
  public connect(sendFn: SendFunction<TEventMap>): void {
    this.sendFunction = sendFn;
    this.isQueuing = false;
    this.flushQueue();
  }

  /**
   * Check if events listener is in queuing mode
   */
  public isInQueueMode(): boolean {
    return this.isQueuing;
  }

  /**
   * Send a message (queued if not connected, sent directly if connected)
   */
  public send<K extends keyof TEventMap>(type: K, data: TEventMap[K]): void {
    if (!this.isQueuing && this.sendFunction) {
      this.sendFunction(type, data);
    } else {
      this.enqueueMessage({ type, data });
    }
  }

  private enqueueMessage(message: QueuedMessage<TEventMap>): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
  }

  private flushQueue(): void {
    if (!this.sendFunction) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        // Safe to cast because message came from the same event map
        this.sendFunction(
          message.type as keyof TEventMap & string,
          message.data as TEventMap[keyof TEventMap],
        );
      }
    }
  }
}

export type EventsListenerOptions = {
  /**
   * Maximum number of messages to queue before DevTools connects.
   * @default 200
   */
  maxQueueSize?: number;
};

/**
 * Create a new events listener instance for a specific event map.
 * This factory can be used to create listeners for different protocols or plugins.
 */
export const createEventsListener = <TEventMap extends Record<string, unknown>>(): EventsListener<TEventMap> => {
  return new EventsListener<TEventMap>();
};
