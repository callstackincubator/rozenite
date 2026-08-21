import type { DeviceFrame } from '../types.js';
import type { DeviceAction } from './types.js';

/**
 * Fusebox's binding name for the frontend-side `Runtime.bindingCalled`
 * listener, normally installed via `Runtime.addBinding` (which this bridge
 * answers locally — see `translate-host-message.ts` — rather than actually
 * installing on the device). Included so the synthesized event is
 * well-formed CDP, but it is decoration: `packages/app/src/connection/
 * bindings.ts`'s `parseRozeniteBindingPayload` matches only on
 * `method === 'Runtime.bindingCalled'` and reads `params.payload`; it never
 * reads `params.name`. Routing to the right plugin happens on the `domain`
 * field *inside* the JSON string carried by `payload`, not on this name.
 */
const BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';

/**
 * Lynx has no concept of the CDP "execution context" this field nominally
 * identifies, and — like `name` above — the host never reads it either
 * (`parseRozeniteBindingPayload` only looks at `params.payload`). A fixed
 * placeholder keeps the synthesized event well-formed CDP without implying
 * a real execution context exists.
 */
const EXECUTION_CONTEXT_ID = 0;

/** The one `Customized` message type this bridge understands: how
 * `lynx.getDevtool().dispatchEvent({ type: 'rozenite', data })` on the
 * device surfaces on the wire, and therefore how `@rozenite/lynx` plugin
 * messages reach the host. */
const ROZENITE_CUSTOMIZED_TYPE = 'rozenite';

/**
 * Prefix Lynx's V8 inspector backend uses for the background-thread (BTS)
 * execution context's name in `Runtime.executionContextCreated`
 * (`lynx/devtool/lynx_devtool/js_debug/js/v8/manager/
 * v8_inspector_manager_impl.cc:28-29`; the prefix itself is
 * `kTargetJSPrefix` in `.../inspector_const_extend.h:37`).
 */
const BACKGROUND_CONTEXT_NAME_PREFIX = 'Background:';

/** The exact context name `MAIN_EXECUTION_CONTEXT_NAME` in
 * `packages/app/src/connection/device-connection.ts` matches on to decide
 * which execution context to bootstrap against, and later watches for
 * `executionContextDestroyed` to detect a JS reload. */
const HOST_MAIN_CONTEXT_NAME = 'main';

/**
 * Lynx never emits `Runtime.executionContextCreated` on the QuickJS/PrimJS
 * backend that ships on device by default — nothing in Lynx emits it
 * explicitly at all. It only happens implicitly on the V8 backend, through
 * the real V8 inspector (`lynx/devtool/js_inspect/v8/
 * v8_inspector_client_impl.cc:274-283`). PrimJS's lack of this event is
 * handled on the other side of this bridge, in `src/server/`, which
 * synthesises one after `Runtime.executionContextsCleared` — see that
 * module for the QuickJS half of this story; this function only handles
 * the event actually arriving from the device.
 *
 * When V8 *does* emit it, `context.name` is never `"main"`. The
 * background (BTS) context — where app JS, the plugin device code, and
 * the `@rozenite/lynx` dispatcher all actually run — is named
 * `"Background:<group_id>"` (`v8_inspector_manager_impl.cc:28-29`); the
 * main-*thread* Lepus context is named `"Main"` or `"Main:<name>"`.
 * Neither matches `MAIN_EXECUTION_CONTEXT_NAME` (`'main'`, lowercase) in
 * `device-connection.ts`, which is exactly the string it bootstraps
 * against.
 *
 * From Rozenite's point of view the background runtime *is* the main JS
 * context, so a `"Background:..."` name is rewritten to `"main"` here.
 * The Lepus `"Main"`/`"Main:..."` context is the main *thread*, not the
 * main JS runtime, and must NOT be renamed: doing so would make the host
 * latch onto the wrong context id, and a real background reload (an
 * `executionContextDestroyed` for the BTS context) would then go
 * undetected because the host would be watching the Lepus context's id
 * instead.
 *
 * `context.id` — the value `executionContextDestroyed` is later matched
 * against — and every other field pass through untouched. Defensive like
 * the rest of this module: any shape that isn't exactly
 * `{ method: 'Runtime.executionContextCreated', params: { context: {
 * name: string } } }` falls through to a plain, unmodified message rather
 * than throwing.
 */
const rewriteBackgroundContextAsMain = (message: unknown): unknown => {
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    return message;
  }
  const record = message as Record<string, unknown>;
  if (record.method !== 'Runtime.executionContextCreated') {
    return message;
  }

  const params = record.params;
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    return message;
  }
  const paramsRecord = params as Record<string, unknown>;

  const context = paramsRecord.context;
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    return message;
  }
  const contextRecord = context as Record<string, unknown>;

  const name = contextRecord.name;
  if (typeof name !== 'string' || !name.startsWith(BACKGROUND_CONTEXT_NAME_PREFIX)) {
    return message;
  }

  return {
    ...record,
    params: {
      ...paramsRecord,
      context: {
        ...contextRecord,
        name: HOST_MAIN_CONTEXT_NAME,
      },
    },
  };
};

/**
 * Translates one frame already unwrapped from its DebugRouter envelope
 * into what the bridge should do with it.
 *
 * Pure: never throws. A malformed or unrecognized frame becomes
 * `{ kind: 'drop', ... }` rather than an exception — a device (or a bug
 * upstream in the DebugRouter transport layer) must not be able to crash
 * the dev server.
 */
export const translateDeviceFrame = (frame: DeviceFrame): DeviceAction => {
  // `frame` is typed as `DeviceFrame`, but this function is a boundary a
  // future caller could still hand something malformed to (a bad cast, a
  // transport bug) — checked defensively rather than trusted blindly.
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    return { kind: 'drop', reason: 'Device frame is not an object.' };
  }

  if (frame.kind === 'cdp') {
    // A CDP response or event — forwarded to the host, save for the one
    // rewrite `rewriteBackgroundContextAsMain` performs (see its doc
    // comment); every other message passes through that call unchanged.
    return { kind: 'send', message: rewriteBackgroundContextAsMain(frame.message) };
  }

  if (frame.kind === 'customized') {
    if (frame.type !== ROZENITE_CUSTOMIZED_TYPE) {
      return { kind: 'drop', reason: `Unhandled Customized type "${String(frame.type)}".` };
    }

    if (typeof frame.data !== 'string') {
      return {
        kind: 'drop',
        reason: 'rozenite Customized frame data is not a string.',
      };
    }

    return {
      kind: 'send',
      message: {
        method: 'Runtime.bindingCalled',
        params: {
          name: BINDING_NAME,
          executionContextId: EXECUTION_CONTEXT_ID,
          // The device's raw string, passed through untouched. Do not
          // parse-and-restringify: that would silently normalise key
          // order (and any other formatting) and lose fidelity with what
          // the device actually sent.
          payload: frame.data,
        },
      },
    };
  }

  return {
    kind: 'drop',
    reason: `Unknown device frame kind "${String((frame as { kind?: unknown }).kind)}".`,
  };
};
