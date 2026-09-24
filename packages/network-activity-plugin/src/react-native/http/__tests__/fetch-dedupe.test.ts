import { describe, expect, it } from 'vitest';
import {
  beginActiveFetchCall,
  endActiveFetchCall,
  markActiveFetchCallSentXhr,
} from '../fetch-dedupe';

// The real dedupe path is: `wrapFetch` starts a marker synchronously around
// `original.apply(...)`, and the XHR hook's patched `send` — invoked
// synchronously inside `whatwg-fetch`'s promise executor — flips it. This
// test exercises exactly that shape with a fake "fetch" that synchronously
// calls a fake "XHR send", without mocking either hook's implementation.
describe('fetch/XHR dedupe marker', () => {
  const fakeFetchThatSendsXhr = () => {
    const marker = beginActiveFetchCall();
    try {
      // Stands in for `whatwg-fetch` constructing an XMLHttpRequest and
      // calling `send()` synchronously inside the promise executor.
      markActiveFetchCallSentXhr();
    } finally {
      endActiveFetchCall(marker);
    }
    return marker;
  };

  const fakeFetchThatDoesNotSendXhr = () => {
    const marker = beginActiveFetchCall();
    endActiveFetchCall(marker);
    return marker;
  };

  it('flags a call whose synchronous phase sent an XHR', () => {
    const marker = fakeFetchThatSendsXhr();
    expect(marker.sentXhr).toBe(true);
  });

  it('leaves a call that sent no XHR unflagged', () => {
    const marker = fakeFetchThatDoesNotSendXhr();
    expect(marker.sentXhr).toBe(false);
  });

  it('does not leak a marker into an unrelated, later call', () => {
    fakeFetchThatSendsXhr();
    // A `send()` firing after its owning call ended (e.g. on a later tick)
    // must not flag a subsequent, unrelated fetch call's marker.
    const later = beginActiveFetchCall();
    expect(later.sentXhr).toBe(false);
    endActiveFetchCall(later);
  });

  it('isolates concurrent calls: only the active marker at send-time is flagged', () => {
    const first = beginActiveFetchCall();
    endActiveFetchCall(first);

    const second = beginActiveFetchCall();
    markActiveFetchCallSentXhr();
    endActiveFetchCall(second);

    expect(first.sentXhr).toBe(false);
    expect(second.sentXhr).toBe(true);
  });
});
