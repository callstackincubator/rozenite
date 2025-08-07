import type EventSource from 'react-native-sse';

const NOOP = () => {
  // noop
};

const MOCK_EVENT_SOURCE = class {
  open = NOOP;
  close = NOOP;
  addEventListener = NOOP;
  removeEventListener = NOOP;
  dispatch = NOOP;
  removeAllEventListeners = NOOP;
};

export const getEventSource = (): typeof EventSource => {
  try {
    const { default: EventSource } = require('react-native-sse');
    return EventSource;
  } catch {
    // This is a workaround for the fact that Vite doesn't support require() calls for in-project dependencies.
    // We are going to return a mock object, so the code will work fine, but it will not be able to intercept SSE requests.
    return MOCK_EVENT_SOURCE;
  }
};
