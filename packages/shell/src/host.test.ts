// @vitest-environment jsdom
import { afterEach, vi } from 'vitest';
import { createParentWindowHost } from './host';
import { runShellHostConformance } from './testing/host-conformance';

afterEach(() => {
  vi.restoreAllMocks();
});

runShellHostConformance('createParentWindowHost', () => {
  const host = createParentWindowHost();
  const postMessage = vi.spyOn(window.parent, 'postMessage');

  return {
    host,
    sent: () => postMessage.mock.calls.map(([message]) => message),
    deliver: (message: unknown) => {
      window.dispatchEvent(new MessageEvent('message', { data: message, source: window.parent }));
    },
  };
});
