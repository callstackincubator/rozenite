/**
 * The wire contract between a Rozenite host and the device it drives, defined
 * once. A *host* is the side that holds a Fusebox CDP socket to a device and
 * runs the Rozenite handshake: `@rozenite/runtime`, `@rozenite/app` and
 * `@rozenite/middleware`. The Lynx dev-server bridge (`@rozenite/lynx`)
 * produces what those hosts consume and imports the same vocabulary.
 *
 * Published as the `@rozenite/tools/protocol` subpath so browser-side hosts
 * can share it without pulling this package's Node-only entry point into a
 * browser bundle. It may import only other import-free modules of this
 * package (`./integration`), and it is typechecked with `types: []`, an
 * ES-only `lib` and a minimal ambient declaration of `setTimeout` /
 * `clearTimeout` (`tsconfig.protocol.json`), so a Node or DOM global in here
 * fails the build instead of leaking into a browser bundle.
 *
 * See ADR 0003.
 */

/** The global the device installs; every host talks to the device through it. */
export const FUSEBOX_DISPATCHER_GLOBAL = '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__';

/** The dispatcher domain Rozenite plugin messages travel on. */
export const ROZENITE_DOMAIN = 'rozenite';

/** The dispatcher domain React Native's own React DevTools integration uses. */
export const REACT_DEVTOOLS_DOMAIN = 'react-devtools';

/**
 * Name of the execution context a host bootstraps against, and watches for
 * recreation to detect a JS reload.
 *
 * Hermes doesn't support the Workers API yet, so there is a single execution
 * context at the moment; this is an extra check to future-proof the logic.
 * See https://github.com/facebook/react-native/blob/40b54ee671e593d125630391119b880aebc8393d/packages/react-native/ReactCommon/jsinspector-modern/InstanceTarget.cpp#L61
 */
export const MAIN_EXECUTION_CONTEXT_NAME = 'main';

/**
 * The binding name the Lynx bridge reports in the `Runtime.bindingCalled`
 * events it synthesises. Hosts must NOT use this to register or filter
 * bindings: they read the real name from the device
 * (`buildBindingNameExpression`). It is decoration on the bridge's events.
 */
export const LYNX_BRIDGE_BINDING_NAME = '__CHROME_DEVTOOLS_FRONTEND_BINDING__';

/** Attempts a host makes at finding the dispatcher before giving up. */
export const DISPATCHER_INIT_MAX_ATTEMPTS = 20;
/** Delay between dispatcher-wait attempts. */
export const DISPATCHER_INIT_RETRY_MS = 250;
/** Attempts a host makes at recovering a lost connection. */
export const RECOVERY_MAX_ATTEMPTS = 16;
/** Delay between recovery attempts. */
export const RECOVERY_RETRY_DELAY_MS = 500;
/** Coalesces a burst of `executionContextCreated("main")` into one bootstrap. */
export const BOOTSTRAP_DEBOUNCE_MS = 500;

// The bracketed reasons the inspector proxy (and the Lynx bridge) close a
// host socket with. Matching is by `includes`, so they only need to appear
// somewhere in the close reason.

/** The device is being torn down and recreated (e.g. an app reload). Recoverable. */
export const RECREATING_DEVICE_CLOSE_REASON = '[RECREATING_DEVICE]';
/** The page the host connected to no longer exists. Recoverable. */
export const PAGE_NOT_FOUND_CLOSE_REASON = '[PAGE_NOT_FOUND]';
/** The transport to the device dropped. Recoverable. */
export const CONNECTION_LOST_CLOSE_REASON = '[CONNECTION_LOST]';
/** Another debugger took the device. Terminal: retrying would fight it. */
export const NEW_DEBUGGER_OPENED_CLOSE_REASON = '[NEW_DEBUGGER_OPENED]';

/** Close reasons after which a host should reconnect, in match order. */
export const RECOVERABLE_CLOSE_REASONS: readonly string[] = [
  RECREATING_DEVICE_CLOSE_REASON,
  PAGE_NOT_FOUND_CLOSE_REASON,
  CONNECTION_LOST_CLOSE_REASON,
];

export type CloseReasonClass = 'recoverable' | 'taken-by-another-debugger' | 'terminal';

/** The first recoverable close reason contained in `reason`, if any. */
export const findRecoverableCloseReason = (reason: string): string | undefined =>
  RECOVERABLE_CLOSE_REASONS.find((candidate) => reason.includes(candidate));

/**
 * What a host should do about a socket that closed with `reason`. Another
 * debugger taking the device wins over everything else.
 */
export const classifyCloseReason = (reason: string): CloseReasonClass => {
  if (reason.includes(NEW_DEBUGGER_OPENED_CLOSE_REASON)) {
    return 'taken-by-another-debugger';
  }
  return findRecoverableCloseReason(reason) === undefined ? 'terminal' : 'recoverable';
};

/**
 * Escapes every non-ASCII code unit as a `\uXXXX` escape sequence, so that the
 * JS source text handed to `Runtime.evaluate` is pure ASCII.
 *
 * Hermes compiles that source text from UTF-8 and fails on a raw astral-plane
 * code unit with `Invalid UTF-8 code point`, which loses the message without
 * any visible error. The escape sequence it produces is plain ASCII, and the
 * device's own parser turns it back into the original code unit, so the payload
 * the device reconstructs is byte-identical to the one the host serialized.
 *
 * This has to run on the output of the second `JSON.stringify`, never before
 * it: escaped earlier, `JSON.stringify` escapes the backslash instead and the
 * device receives `\uD83C` as six characters of text.
 */
export const toAsciiJsSource = (source: string): string =>
  source.replace(
    /[^\0-\x7F]/g,
    (codeUnit) => `\\u${codeUnit.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

/** Evaluates to `true` once the device has installed the dispatcher. */
export const buildDispatcherReadyExpression = (): string =>
  `globalThis.${FUSEBOX_DISPATCHER_GLOBAL} != undefined`;

/** Evaluates to the binding name the host must `Runtime.addBinding`. */
export const buildBindingNameExpression = (): string => `${FUSEBOX_DISPATCHER_GLOBAL}.BINDING_NAME`;

/** Starts delivering `domain` messages from the device over the binding. */
export const buildInitializeDomainExpression = (domain: string): string =>
  `void ${FUSEBOX_DISPATCHER_GLOBAL}.initializeDomain(${JSON.stringify(domain)})`;

/**
 * Delivers `message` to the device's `domain` listeners. The message is
 * serialized twice: once into the payload string the dispatcher expects, and
 * once more into a JS string literal, then reduced to pure ASCII.
 */
export const buildSendMessageExpression = (domain: string, message: unknown): string => {
  const serializedMessage = JSON.stringify(message);
  const escapedMessage = toAsciiJsSource(JSON.stringify(serializedMessage));
  return `${FUSEBOX_DISPATCHER_GLOBAL}.sendMessage(${JSON.stringify(domain)}, ${escapedMessage})`;
};

export type BindingPayload = {
  domain: string;
  message?: unknown;
};

type RecordValue = Record<string, unknown>;

const getRecord = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : null;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Parses the `payload` of a `Runtime.bindingCalled` event
 * (`JSON.stringify({ domain, message })`). Returns `null` for anything that
 * is not that shape rather than throwing.
 */
export const parseBindingPayload = (payload: string): BindingPayload | null => {
  if (!payload) {
    return null;
  }

  try {
    const parsed = getRecord(JSON.parse(payload));
    const domain = getString(parsed?.domain);
    if (!domain) {
      return null;
    }

    return { domain, message: parsed?.message };
  } catch {
    return null;
  }
};

/**
 * Reads a raw CDP frame: if it is a `Runtime.bindingCalled` event whose
 * payload parses, returns it. Does NOT look at the event's binding `name`;
 * filtering by binding name stays with each host.
 */
export const parseRozeniteBindingCalled = (frame: unknown): BindingPayload | null => {
  const record = getRecord(frame);
  if (!record || record.method !== 'Runtime.bindingCalled') {
    return null;
  }

  const payload = getString(getRecord(record.params)?.payload);
  return payload === undefined ? null : parseBindingPayload(payload);
};

/**
 * Builds the `Runtime.bindingCalled` event the Lynx bridge synthesises from
 * the raw JSON string a Lynx device sent.
 *
 * `payload` is passed through untouched: do not parse and restringify, that
 * would silently normalise key order and lose fidelity with what the device
 * sent. Lynx has no execution contexts, so `executionContextId` is a fixed
 * placeholder that keeps the event well-formed CDP.
 */
export const buildBindingCalledEvent = (payload: string) => ({
  method: 'Runtime.bindingCalled' as const,
  params: {
    name: LYNX_BRIDGE_BINDING_NAME,
    executionContextId: 0,
    payload,
  },
});
