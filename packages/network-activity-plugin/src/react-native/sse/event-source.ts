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
    // `react-native-sse` is an optional peer dependency. Fall back to a mock so
    // the plugin keeps working, just without SSE request interception.
    return MOCK_EVENT_SOURCE;
  }
};
