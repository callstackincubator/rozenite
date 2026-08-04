# Task 01: Add a cancellable plugin request client

**Status:** Pending

## Outcome

`@rozenite/plugin-bridge` exposes a typed Promise-based request helper that correlates request IDs with responses, supports timeout and `AbortSignal`, and cleans up listeners on every terminal path. Existing event clients remain unchanged.

## Dependencies

None.

## Read first

- `docs/workplace/plan.md`
- `packages/plugin-bridge/src/client.ts`
- `packages/plugin-bridge/src/message.ts`
- Existing plugin-bridge tests and exports

## Scope

- Design an additive request helper over `RozeniteDevToolsClient`.
- Generate or accept request IDs without coupling the helper to storage message names.
- Reject on abort, timeout, matching error response, and client disposal.
- Ignore late responses after a request has settled.
- Preserve the existing `send` and `onMessage` APIs.

## Acceptance criteria

- [ ] Concurrent requests resolve only from their matching request IDs.
- [ ] Aborted and timed-out requests remove listeners and cannot resolve later.
- [ ] Existing plugin-bridge consumers compile without modification.

## Verification

- [ ] Run `pnpm --filter @rozenite/plugin-bridge test`.
- [ ] Run `pnpm --filter @rozenite/plugin-bridge typecheck`.
- [ ] Run `pnpm --filter @rozenite/plugin-bridge lint`.

## Self-review focus

Check listener lifecycle, double settlement, timer cleanup, abort races, error typing, and whether the API leaks storage-specific concepts.

## Likely files

- `packages/plugin-bridge/src/client.ts`
- `packages/plugin-bridge/src/index.ts`
- `packages/plugin-bridge/src/*.test.ts`

## Commit

Create one commit after self-review, for example:

`feat(plugin-bridge): add cancellable request client`
