/**
 * Deduplicates fetch and XHR capture. `whatwg-fetch` (React Native's own
 * `fetch`, and Axios by default) constructs an `XMLHttpRequest` and calls
 * `send()` synchronously inside the promise executor. The fetch wrapper sets
 * a marker synchronously around the call to the original `fetch`; the XHR
 * hook's patched `send` flips the marker if one is active. A fetch call that
 * sent an XHR is therefore already recorded by the XHR hook and the fetch
 * wrapper records nothing for it.
 */

type ActiveFetchMarker = { sentXhr: boolean };

let active: ActiveFetchMarker | null = null;

export const beginActiveFetchCall = (): ActiveFetchMarker => {
  const marker: ActiveFetchMarker = { sentXhr: false };
  active = marker;
  return marker;
};

export const endActiveFetchCall = (marker: ActiveFetchMarker): void => {
  if (active === marker) {
    active = null;
  }
};

/** Called by the XHR hook's patched `send`. */
export const markActiveFetchCallSentXhr = (): void => {
  if (active) {
    active.sentXhr = true;
  }
};
