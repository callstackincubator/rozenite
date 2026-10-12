/**
 * The only host globals `src/protocol.ts` (and the shared bootstrap that will
 * live next to it) may use. Included by `tsconfig.protocol.json` only, so it
 * never reaches the published declarations or the rest of the package.
 */
declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function clearTimeout(handle: unknown): void;
