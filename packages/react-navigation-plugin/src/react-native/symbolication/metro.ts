import { NativeModules } from 'react-native';
import type { ActionOriginCodeFrame, ActionStackFrame } from './types';

let cachedMetroOrigin: string | null | undefined;

// Resolved once per process. The bundle URL doesn't change at runtime,
// so the cache is safe for the lifetime of the app. Tests can reset it
// via `__resetMetroOriginCache` between cases.
export const resolveMetroOrigin = (): string | null => {
  if (cachedMetroOrigin !== undefined) return cachedMetroOrigin;
  // On the New Architecture, `SourceCode` is a TurboModule whose
  // constants don't materialize as direct properties on the module
  // object — `getConstants()` is required to access them. Fall back to
  // the legacy direct-property access for older runtimes.
  const sourceCode = NativeModules?.SourceCode as
    | {
        scriptURL?: string;
        getConstants?: () => { scriptURL?: string };
      }
    | undefined;
  const scriptURL =
    sourceCode?.scriptURL ?? sourceCode?.getConstants?.().scriptURL;
  if (!scriptURL) {
    cachedMetroOrigin = null;
    return null;
  }
  try {
    const url = new URL(scriptURL);
    // Release builds load from `file://`; Metro isn't reachable.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      cachedMetroOrigin = null;
      return null;
    }
    cachedMetroOrigin = url.origin;
    return cachedMetroOrigin;
  } catch {
    cachedMetroOrigin = null;
    return null;
  }
};

export const __resetMetroOriginCache = (): void => {
  cachedMetroOrigin = undefined;
};

// Metro returns code-frame content formatted for terminals. DevTools
// renders it as plain text, so escape sequences must be removed.
const ANSI_SEQUENCE_PATTERN = new RegExp(
  [
    '[\\u001b\\u009b][[\\]()#;?]*',
    '(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
    '|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join(''),
  'g',
);

const stripAnsi = (value: string): string =>
  value.replace(ANSI_SEQUENCE_PATTERN, '');

type MetroSymbolicatedFrame = {
  methodName: string;
  file: string | null | undefined;
  lineNumber: number | null | undefined;
  column: number | null | undefined;
  collapse?: boolean;
};

type MetroCodeFrame = {
  fileName: string;
  content: string;
  // Metro versions vary: older responses use top-level line/column,
  // newer ones nest under `location`. Handle both.
  line?: number;
  column?: number;
  location?: { row: number; column: number };
};

type MetroSymbolicateResponse = {
  stack: MetroSymbolicatedFrame[];
  codeFrame?: MetroCodeFrame;
};

const isGeneratedBundleUrl = (url: string | undefined): boolean =>
  !!url && /[^/]+\.bundle(?:[/?#]|$)/.test(url);

const toMetroFrame = (
  frame: ActionStackFrame,
): MetroSymbolicatedFrame | null => {
  if (!frame.generatedUrl) return null;
  return {
    methodName: frame.functionName ?? '<anonymous>',
    file: frame.generatedUrl,
    lineNumber: frame.generatedLineNumber,
    column: frame.generatedColumnNumber,
  };
};

const ANONYMOUS_METRO_METHODS = new Set(['<anonymous>', 'anonymous']);

const fromMetroFrame = (
  metroFrame: MetroSymbolicatedFrame,
  original: ActionStackFrame,
): ActionStackFrame => {
  // Metro returns `file: <bundle url>` for frames it couldn't
  // source-map. Drop that as the source url so the frame stays marked
  // "no source available".
  const sourceUrl =
    metroFrame.file &&
    metroFrame.file !== original.generatedUrl &&
    !isGeneratedBundleUrl(metroFrame.file)
      ? metroFrame.file
      : undefined;

  const resolvedFunctionName =
    metroFrame.methodName && !ANONYMOUS_METRO_METHODS.has(metroFrame.methodName)
      ? metroFrame.methodName
      : original.functionName;

  return {
    functionName: resolvedFunctionName,
    url: sourceUrl,
    lineNumber: sourceUrl ? (metroFrame.lineNumber ?? undefined) : undefined,
    columnNumber: sourceUrl ? (metroFrame.column ?? undefined) : undefined,
    generatedUrl: original.generatedUrl,
    generatedLineNumber: original.generatedLineNumber,
    generatedColumnNumber: original.generatedColumnNumber,
    isCollapsed: metroFrame.collapse,
  };
};

const toCodeFrame = (
  raw: MetroCodeFrame | undefined,
): ActionOriginCodeFrame | undefined => {
  if (!raw) return undefined;
  const line = raw.location?.row ?? raw.line;
  const column = raw.location?.column ?? raw.column;
  if (line === undefined || column === undefined) return undefined;
  return {
    fileName: raw.fileName,
    content: stripAnsi(raw.content),
    line,
    column,
  };
};

export type SymbolicateOptions = {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  // Override the auto-resolved origin. Useful in tests; production
  // code leaves it undefined so `resolveMetroOrigin()` is consulted.
  origin?: string | null;
};

export type SymbolicationOutcome =
  | {
      status: 'complete';
      frames: ActionStackFrame[];
      codeFrame?: ActionOriginCodeFrame;
    }
  | { status: 'failed'; frames: ActionStackFrame[]; error: string }
  | { status: 'unavailable'; frames: ActionStackFrame[] };

const DEFAULT_TIMEOUT_MS = 5000;

export const symbolicateFrames = async (
  frames: ActionStackFrame[],
  options: SymbolicateOptions = {},
): Promise<SymbolicationOutcome> => {
  const origin =
    options.origin !== undefined ? options.origin : resolveMetroOrigin();
  if (!origin) {
    return { status: 'unavailable', frames };
  }

  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const metroFrames = frames
    .map(toMetroFrame)
    .filter((f): f is MetroSymbolicatedFrame => f !== null);

  if (metroFrames.length === 0) {
    return { status: 'unavailable', frames };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(`${origin}/symbolicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stack: metroFrames }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'failed',
        frames,
        error: `Metro responded with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as MetroSymbolicateResponse;
    const mapped = data.stack.map((metroFrame, idx) =>
      fromMetroFrame(metroFrame, frames[idx] ?? {}),
    );
    return {
      status: 'complete',
      frames: mapped,
      codeFrame: toCodeFrame(data.codeFrame),
    };
  } catch (error) {
    clearTimeout(timer);
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `Metro symbolication timed out after ${timeoutMs}ms`
          : error.message
        : 'Metro symbolication failed';
    return { status: 'failed', frames, error: message };
  }
};
