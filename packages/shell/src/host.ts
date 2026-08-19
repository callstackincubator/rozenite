/**
 * Abstraction over the channel the shell uses to talk to its host (the
 * embedding page). The embedded shell is hosted inside a React Native
 * DevTools iframe and talks to `window.parent`; a standalone app hosts the
 * shell directly and talks to whatever it's connected to (e.g. a device
 * bridge) instead. `Shell` depends only on this interface so it can be
 * reused in both contexts.
 */
export type ShellHost = {
  /** Send a message to the host. */
  send: (message: unknown) => void;
  /**
   * Subscribe to messages from the host. Returns an unsubscribe function.
   */
  onMessage: (listener: (message: unknown) => void) => () => void;
};

/**
 * Reproduces the shell's original embedded behaviour: sends to
 * `window.parent`, and listens for `message` events originating from
 * `window.parent`.
 */
export const createParentWindowHost = (): ShellHost => {
  return {
    send: (message: unknown) => {
      window.parent.postMessage(message, '*');
    },
    onMessage: (listener: (message: unknown) => void) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) {
          return;
        }

        listener(event.data);
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    },
  };
};
