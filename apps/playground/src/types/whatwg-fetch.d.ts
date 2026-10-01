// whatwg-fetch ships no TypeScript types. It is React Native's own `fetch`
// polyfill (built on XMLHttpRequest); its exports match the DOM globals.
declare module 'whatwg-fetch' {
  export const fetch: typeof globalThis.fetch & { polyfill?: boolean };
  export const Headers: typeof globalThis.Headers;
  export const Request: typeof globalThis.Request;
  export const Response: typeof globalThis.Response;
}
