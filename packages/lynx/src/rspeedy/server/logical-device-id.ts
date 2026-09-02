/**
 * A stable id for a Lynx client (app instance), independent of
 * DebugRouter's own `client_id`.
 *
 * DebugRouter mints a fresh numeric `client_id` every time an app process
 * registers with it — not just on a fresh install, but on every reload.
 * If `/json/list` surfaced that number as `reactNative.logicalDeviceId`,
 * a target the host saved for later reconnection (see
 * `packages/app/src/connection/target-from-url.ts`'s `deviceId`, read
 * back by `resolveMetroTarget` in `metro-target-resolution.ts` after a
 * recoverable disconnect) would go stale on the very next reload:
 * `resolveMetroTarget` filters `/json/list` on
 * `logicalDeviceId === deviceId`, and a `client_id` that no longer exists
 * matches nothing there, so it throws "No Metro target is currently
 * available" — even though, from a developer's point of view, the same
 * app on the same device is still right there.
 *
 * React Native has exactly the same shape of problem — Metro's own
 * `logicalDeviceId` is not the transient id of one debugger connection
 * either, but something derived from fields that describe the *device and
 * app* and survive a reload. This id follows the same rule: it is derived
 * from `LynxClient.os`, `LynxClient.deviceId` (the physical serial/udid
 * DebugRouter discovered the client on) and `LynxClient.appName`. All
 * three survive a reload; together they are exactly the granularity
 * `/json/list` needs to tell two different targets apart (the same app on
 * two devices, or two different apps on the same device), without ever
 * depending on which DebugRouter connection happens to be current.
 */
import type { LynxClient } from '../types.js';

/**
 * Everything outside this set collapses to a single `_`, so the id stays
 * a safe path/query component (and a single URL-safe token) no matter
 * what a device serial, OS name, or app id actually contains.
 */
const UNSAFE_CHARACTERS = /[^A-Za-z0-9_.-]+/g;

const sanitize = (value: string): string => {
  const safe = value.replace(UNSAFE_CHARACTERS, '_');
  // An empty (or entirely-unsafe) field must still contribute a token, or
  // two clients that differ only in that field could collide on the same id.
  return safe.length > 0 ? safe : '_';
};

export const computeLogicalDeviceId = (client: LynxClient): string =>
  [client.os, client.deviceId, client.appName].map(sanitize).join('-');

/**
 * Resolves a `logicalDeviceId` to its current client, if one is connected.
 *
 * Deliberately not memoized, and there is deliberately no persistent
 * `logicalDeviceId -> clientId` map kept anywhere in this module.
 * `computeLogicalDeviceId` is a pure function of fields already sitting on
 * every entry `LynxTransport.listClients()` returns, so there is nothing
 * to cache and nothing that could fall out of sync: every call re-derives
 * ids from whatever `listClients()` reports *right now*. That is exactly
 * what makes a reload transparent — the old client vanishes from that
 * list, a new one with a new `clientId` but the same
 * `os`/`deviceId`/`appName` takes its place, and the very next call here
 * resolves straight to it.
 */
export const findClientByLogicalDeviceId = (
  clients: LynxClient[],
  logicalDeviceId: string,
): LynxClient | undefined =>
  clients.find((client) => computeLogicalDeviceId(client) === logicalDeviceId);
