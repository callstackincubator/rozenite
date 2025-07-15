import { Channel } from '../types';

export const getPanelChannel = async (): Promise<Channel> => {
  const listeners = new Set<(message: unknown) => void>();

  const handleMessage = (event: MessageEvent) => {
    listeners.forEach((listener) => {
      listener(event.data);
    });
  };

  window.addEventListener('message', handleMessage);

  return {
    send: (message: unknown) => {
      window.parent.postMessage(
        { type: 'rozenite-message', payload: message },
        '*'
      );
    },
    onMessage: (listener: (message: unknown) => void) => {
      listeners.add(listener);

      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
    close: () => {
      listeners.clear();
      window.removeEventListener('message', handleMessage);
    },
  };
};
