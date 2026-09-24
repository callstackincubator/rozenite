declare global {
  interface XMLHttpRequest {
    // Not underscore-prefixed in RN's own type, but not part of the spec
    // either — there is no public API for a request's raw response headers.
    responseHeaders?: { [key: string]: string };
  }
}

export {};
