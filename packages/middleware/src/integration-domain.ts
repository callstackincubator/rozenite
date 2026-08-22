/**
 * Answers a `Rozenite.getEnvironment` CDP domain from inside
 * `@react-native/dev-middleware`'s inspector proxy, so a connected debugger
 * (i.e. a Rozenite plugin's panel) can ask which integration it's talking to
 * before doing anything platform-specific — this producer side just answers
 * the question; nothing in this PR consumes it yet.
 *
 * We don't own dev-middleware's `createDevMiddleware` call — the embedder
 * (React Native CLI, Expo, Re.Pack) does — so there is no hook to add our
 * own `unstable_customInspectorMessageHandler` through. Instead we patch the
 * module in place before the embedder constructs it. See
 * `patchRozeniteIntegrationDomain` below for the mechanics and the ordering
 * hazard that makes this safe.
 */
import { resolveIntegration, type RozeniteHostIntegration } from '@rozenite/tools';
import { requireDevMiddlewareInternal } from './resolve.js';
import { logger } from './logger.js';
import { RozeniteConfig } from './index.js';

const GET_ENVIRONMENT_METHOD = 'Rozenite.getEnvironment';

// `@react-native/dev-middleware`'s `exports` map only allows `.` and
// `./package.json` (see `patchRozeniteIntegrationDomain`), so its own
// `CustomMessageHandler` types aren't importable from here either. This is a
// minimal local mirror of the wire shape we actually read and write -
// `JSONSerializable` upstream is a bare JSON union with no `method`/`id`
// fields, which is why every access below goes through `asRecord`.
type JSONRecord = { [key: string]: unknown };

// Narrowed to the one member this file touches. The real connection
// upstream also carries `page` and `device` (and the debugger's user
// agent); structural typing means the real object still satisfies this,
// and declaring only what is read keeps the mirror from having to track
// fields whose shape we never depend on.
type CustomMessageHandlerConnection = {
  debugger: {
    sendMessage: (message: unknown) => void;
  };
};

type CustomMessageHandler = {
  handleDeviceMessage(message: unknown): true | void;
  handleDebuggerMessage(message: unknown): true | void;
};

type CreateCustomMessageHandlerFn = (
  connection: CustomMessageHandlerConnection,
) => null | undefined | CustomMessageHandler;

const asRecord = (value: unknown): JSONRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JSONRecord) : undefined;

/**
 * Builds the per-connection (device + debugger pair) message handler that
 * answers `Rozenite.getEnvironment`. Exported standalone so it's unit
 * testable against fake connection objects without spinning up a real
 * dev-middleware instance.
 *
 * A malformed or unexpectedly-shaped frame must never crash the inspector
 * proxy. Reading one is total on its own — `asRecord` narrows anything the
 * wire can carry and every access after it is optional-chained — so the
 * try/catches below guard only the two things that can genuinely throw:
 * code we don't own (the embedder's handlers) and the reply send.
 */
export const createRozeniteIntegrationMessageHandlerFactory = (
  hostIntegration: RozeniteHostIntegration,
  existingFactory: CreateCustomMessageHandlerFn | null | undefined,
): CreateCustomMessageHandlerFn => {
  return (connection) => {
    let existing: CustomMessageHandler | null | undefined;
    try {
      // Expo's factory returns null for pages it doesn't support - a
      // handler-less connection is expected, not an error.
      existing = existingFactory ? existingFactory(connection) : null;
    } catch (error) {
      logger.debug('Rozenite: embedder inspector message handler factory threw.', error);
      existing = null;
    }

    // Remembered per connection, snooped off the device's own
    // ReactNativeApplication.metadataUpdated event. Until that event
    // arrives, resolveIntegration treats the unknown platform the same as
    // a non-web one - the same outcome a device that never reports it
    // (an older RN version) would get.
    let targetPlatform: unknown;

    return {
      handleDeviceMessage(message) {
        const record = asRecord(message);
        if (record?.method === 'ReactNativeApplication.metadataUpdated') {
          targetPlatform = asRecord(record.params)?.platform;
        }

        // Snoop only - never claim the message, so it still reaches the
        // debugger (and, unconditionally, the embedder's own handler).
        try {
          return existing?.handleDeviceMessage?.(message);
        } catch (error) {
          logger.debug('Rozenite: embedder device message handler threw.', error);
          return undefined;
        }
      },

      handleDebuggerMessage(message) {
        const record = asRecord(message);
        if (record?.method === GET_ENVIRONMENT_METHOD) {
          try {
            connection.debugger.sendMessage({
              id: record.id,
              result: { integration: resolveIntegration(hostIntegration, targetPlatform) },
            });
          } catch (error) {
            logger.debug('Rozenite: failed to reply to Rozenite.getEnvironment.', error);
          }

          // Handled regardless of whether the reply above succeeded: a
          // real device has no `Rozenite` domain and would answer -32601,
          // breaking the connection, so this must never be forwarded to it.
          return true;
        }

        try {
          return existing?.handleDebuggerMessage?.(message);
        } catch (error) {
          logger.debug('Rozenite: embedder debugger message handler threw.', error);
          return undefined;
        }
      },
    };
  };
};

/** Marks a `createDevMiddleware` export as already wrapped by us, so a
 * second `patchRozeniteIntegrationDomain` call (e.g. a double
 * `initializeRozenite`) composes with itself only once. */
const ROZENITE_PATCHED = Symbol.for('rozenite.integrationDomainPatched');

type PatchableCreateDevMiddleware = ((options: JSONRecord) => unknown) & {
  [ROZENITE_PATCHED]?: true;
};

/**
 * Patches `@react-native/dev-middleware`'s `createDevMiddleware` so every
 * inspector proxy connection it creates gets a `Rozenite.getEnvironment`
 * handler, composed with whatever `unstable_customInspectorMessageHandler`
 * the embedder (e.g. Expo) already passes.
 *
 * This is an `unstable_` API with no semver guarantee, so every failure
 * mode here degrades to a warning: the client falls back to the
 * config-supplied host integration (see `RozeniteAppConfigResponse.integration`
 * in `middleware.ts`) rather than crashing the dev server.
 *
 * Two facts about the package shape make this a patch rather than a plain
 * option, and make ordering load-bearing:
 *
 * - Its `exports` map only allows `.` and `./package.json`, so a deep
 *   specifier like `@react-native/dev-middleware/createDevMiddleware` throws
 *   `ERR_PACKAGE_PATH_NOT_EXPORTED` - hence `requireDevMiddlewareInternal`,
 *   shared with `dev-tools-url-patch.ts`, which reaches the module by path
 *   instead.
 * - The package index re-exports `createDevMiddleware` as a GETTER that
 *   re-reads the inner module's `exports.default` on every access, but the
 *   getter itself is not writable - only the inner module's `default` is.
 *   Patch that.
 * - Because the getter re-reads on access, patching before the embedder's
 *   own `require('@react-native/dev-middleware')` (and any destructuring of
 *   it) is what makes this reliable: a destructure captures the getter's
 *   *current* return value into a local binding, so an embedder that reads
 *   `createDevMiddleware` before we patch keeps its own unpatched
 *   reference forever, silently. We patch at Metro-config load; Expo's own
 *   `unstable_customInspectorMessageHandler` isn't wired in until its dev
 *   server actually starts, so we are always ahead - but there is no way to
 *   detect the embedder's read from here, which is why the guard below only
 *   verifies our own write stuck.
 */
export const patchRozeniteIntegrationDomain = (options: RozeniteConfig): void => {
  try {
    const hostIntegration: RozeniteHostIntegration = options.integration ?? 'react-native';
    const innerModule = requireDevMiddlewareInternal(options, 'createDevMiddleware.js');
    const original = innerModule.default as PatchableCreateDevMiddleware | undefined;

    if (typeof original !== 'function') {
      logger.warn(
        'Rozenite could not find createDevMiddleware to patch (unexpected @react-native/dev-middleware module shape). ' +
          'The Rozenite.getEnvironment CDP domain will be unavailable; falling back to the config-supplied integration.',
      );
      return;
    }

    if (original[ROZENITE_PATCHED]) {
      // Already patched by an earlier initializeRozenite call.
      return;
    }

    const patched: PatchableCreateDevMiddleware = (devMiddlewareOptions: JSONRecord) =>
      original({
        ...devMiddlewareOptions,
        unstable_customInspectorMessageHandler: createRozeniteIntegrationMessageHandlerFactory(
          hostIntegration,
          devMiddlewareOptions.unstable_customInspectorMessageHandler as
            | CreateCustomMessageHandlerFn
            | null
            | undefined,
        ),
      });
    patched[ROZENITE_PATCHED] = true;

    innerModule.default = patched;

    if (innerModule.default !== patched) {
      // The assignment above didn't stick - e.g. a future dev-middleware
      // makes `default` non-writable too. Degrade rather than assume the
      // domain is live.
      logger.warn(
        'Rozenite patched @react-native/dev-middleware but the patch did not take effect. ' +
          'The Rozenite.getEnvironment CDP domain will be unavailable; falling back to the config-supplied integration.',
      );
    }
  } catch (error) {
    logger.warn(
      'Rozenite failed to patch @react-native/dev-middleware for the Rozenite.getEnvironment CDP domain. ' +
        'Falling back to the config-supplied integration.',
      error,
    );
  }
};
