import { describe, expect, it, vi } from 'vitest';
import { createEventsListener } from '../events-listener';

type EventMap = {
  'request-sent': { id: string };
  'websocket-open': { id: string };
};

describe('events listener', () => {
  it('filters queued messages when connecting', () => {
    const listener = createEventsListener<EventMap>();
    const send = vi.fn();

    listener.enableQueuing();
    listener.send('request-sent', { id: 'http-1' });
    listener.send('websocket-open', { id: 'ws-1' });

    listener.connect(send, (message) => message.type === 'websocket-open');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('websocket-open', { id: 'ws-1' });
  });

  it('keeps applying the filter to live messages after connecting', () => {
    const listener = createEventsListener<EventMap>();
    const send = vi.fn();

    listener.connect(send, (message) => message.type === 'websocket-open');
    listener.send('request-sent', { id: 'http-1' });
    listener.send('websocket-open', { id: 'ws-1' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('websocket-open', { id: 'ws-1' });
  });
});
