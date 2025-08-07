import type EventSource from 'react-native-sse';

export interface EventSourceWithInternals<E extends string = never>
  extends EventSource<E> {
  url: string;

  /** Used internally to mark the underlying XHR to skip it in XHR interceptor. */
  _xhr?: XMLHttpRequest;
}
