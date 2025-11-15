import { XHRInterceptor } from './xhr-interceptor';
import { XHRPostData } from '../../shared/client';

type QueuedRequest = {
  type: 'send';
  data: XHRPostData;
  request: XMLHttpRequest;
  timestamp: number;
};

type QueuedEvent = QueuedRequest;

/**
 * A wrapper around XHRInterceptor that automatically enables on boot
 * and queues all intercepted requests until a consumer (NetworkInspector)
 * is ready to process them.
 */
class QueuedXHRInterceptor {
  private eventQueue: QueuedEvent[] = [];
  private sendCallback: ((data: XHRPostData, request: XMLHttpRequest) => void) | null = null;
  private overrideCallback: ((request: XMLHttpRequest) => void) | null = null;
  private isConsuming = false;
  private maxQueueSize = 100; // Prevent memory issues

  constructor() {
    // Auto-enable on boot to capture early requests
    this.enableQueueing();
  }

  /**
   * Enable the interceptor in queuing mode
   */
  private enableQueueing(): void {
    XHRInterceptor.disableInterception();
    
    // Set up queuing callbacks
    XHRInterceptor.setSendCallback((data, request) => {
      if (this.sendCallback && this.isConsuming) {
        // If we have a consumer and we're in consuming mode, forward directly
        this.sendCallback(data, request);
      } else {
        // Otherwise, queue the request
        this.enqueueEvent({
          type: 'send',
          data,
          request,
          timestamp: Date.now(),
        });
      }
    });

    XHRInterceptor.setOverrideCallback((request) => {
      if (this.overrideCallback) {
        this.overrideCallback(request);
      }
    });

    XHRInterceptor.enableInterception();
  }

  /**
   * Add an event to the queue
   */
  private enqueueEvent(event: QueuedEvent): void {
    // Prevent unbounded queue growth
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest event (FIFO)
      this.eventQueue.shift();
    }
    
    this.eventQueue.push(event);
  }

  /**
   * Set the callbacks that will consume the events
   * This also flushes the queue of any pending events
   */
  public setCallbacks(
    sendCallback: (data: XHRPostData, request: XMLHttpRequest) => void,
    overrideCallback: (request: XMLHttpRequest) => void
  ): void {
    this.sendCallback = sendCallback;
    this.overrideCallback = overrideCallback;
    
    // Flush the queue
    this.flushQueue();
    
    // Switch to consuming mode
    this.isConsuming = true;
  }

  /**
   * Flush all queued events to the consumer
   */
  private flushQueue(): void {
    if (!this.sendCallback) {
      return;
    }

    // Process all queued events
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      if (!event) {
        break;
      }

      if (event.type === 'send') {
        this.sendCallback(event.data, event.request);
      }
    }
  }

  /**
   * Get the number of queued events
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear the queue without processing
   */
  public clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Stop consuming and go back to queuing mode
   */
  public stopConsuming(): void {
    this.isConsuming = false;
    this.sendCallback = null;
    this.overrideCallback = null;
  }

  /**
   * Completely disable the interceptor
   */
  public disable(): void {
    this.stopConsuming();
    this.clearQueue();
    XHRInterceptor.disableInterception();
  }

  /**
   * Check if the interceptor is enabled
   */
  public isEnabled(): boolean {
    return XHRInterceptor.isInterceptorEnabled();
  }
}

// Store the singleton in global scope to survive hot reloads
declare global {
  var __rozeniteQueuedXHRInterceptor: QueuedXHRInterceptor | undefined;
}

// Get or create singleton instance - persists across hot reloads via global
const getInstance = (): QueuedXHRInterceptor => {
  if (!global.__rozeniteQueuedXHRInterceptor) {
    global.__rozeniteQueuedXHRInterceptor = new QueuedXHRInterceptor();
  }
  return global.__rozeniteQueuedXHRInterceptor;
};

// Eagerly create the instance on module load
const instance = getInstance();

export const getQueuedXHRInterceptor = (): QueuedXHRInterceptor => {
  return instance;
};
