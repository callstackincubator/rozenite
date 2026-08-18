/**
 * Minimal ambient typings for the global `fetch`, available at runtime on
 * Node >= 20 (this package's minimum supported version) but not yet
 * declared by the `@types/node` version pinned in this monorepo. Scoped to
 * just what `metro-discovery.ts` needs rather than pulling in the full DOM
 * lib.
 */
export {};

declare global {
  interface Response {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
  }

  function fetch(input: string): Promise<Response>;
}
