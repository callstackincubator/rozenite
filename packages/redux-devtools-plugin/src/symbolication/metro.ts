import { NativeModules } from 'react-native';
import type { ReduxTraceCodeFrame, ReduxTraceFrame } from '../shared/trace';

let cachedMetroOrigin: string | null | undefined;

export const resolveMetroOrigin = (): string | null => {
  if (cachedMetroOrigin !== undefined) {
    return cachedMetroOrigin;
  }

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
  line?: number;
  column?: number;
  location?: { row: number; column: number };
};

type MetroSymbolicateResponse = {
  stack: MetroSymbolicatedFrame[];
  codeFrame?: MetroCodeFrame;
};

export type SymbolicationOutcome =
  | {
      status: 'complete';
      frames: ReduxTraceFrame[];
      codeFrame?: ReduxTraceCodeFrame;
    }
  | { status: 'failed'; frames: ReduxTraceFrame[]; error: string }
  | { status: 'unavailable'; frames: ReduxTraceFrame[] };

export type SymbolicateOptions = {
  fetch?: typeof globalThis.fetch;
  origin?: string | null;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5000;

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

const isGeneratedBundleUrl = (url: string | undefined): boolean =>
  !!url && /[^/]+\.bundle(?:[/?#]|$)/.test(url);

const isSymbolicatableUrl = (url: string | undefined): boolean =>
  url?.startsWith('http://') || url?.startsWith('https://') || false;

const toMetroFrame = (frame: ReduxTraceFrame): MetroSymbolicatedFrame | null => {
  if (!isSymbolicatableUrl(frame.generatedUrl)) {
    return null;
  }

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
  original: ReduxTraceFrame,
): ReduxTraceFrame => {
  const sourceUrl =
    metroFrame.file &&
    metroFrame.file !== original.generatedUrl &&
    !isGeneratedBundleUrl(metroFrame.file)
      ? metroFrame.file
      : undefined;

  const functionName =
    metroFrame.methodName && !ANONYMOUS_METRO_METHODS.has(metroFrame.methodName)
      ? metroFrame.methodName
      : original.functionName;

  return {
    functionName,
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
  codeFrame: MetroCodeFrame | undefined,
): ReduxTraceCodeFrame | undefined => {
  if (!codeFrame) {
    return undefined;
  }

  const line = codeFrame.location?.row ?? codeFrame.line;
  const column = codeFrame.location?.column ?? codeFrame.column;
  if (line === undefined || column === undefined) {
    return undefined;
  }

  return {
    fileName: codeFrame.fileName,
    content: stripAnsi(codeFrame.content),
    line,
    column,
  };
};

export const symbolicateFrames = async (
  frames: ReduxTraceFrame[],
  options: SymbolicateOptions = {},
): Promise<SymbolicationOutcome> => {
  const origin =
    options.origin !== undefined ? options.origin : resolveMetroOrigin();
  if (!origin) {
    return { status: 'unavailable', frames };
  }

  const entries = frames.flatMap((frame, originalIndex) => {
    const metroFrame = toMetroFrame(frame);
    return metroFrame ? [{ frame: metroFrame, originalIndex }] : [];
  });

  if (entries.length === 0) {
    return { status: 'unavailable', frames };
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetch ?? globalThis.fetch)(
      `${origin}/symbolicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stack: entries.map((entry) => entry.frame) }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'failed',
        frames,
        error: `Metro responded with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as MetroSymbolicateResponse;
    const mappedFrames = [...frames];

    data.stack.forEach((metroFrame, index) => {
      const entry = entries[index];
      if (!entry) {
        return;
      }

      mappedFrames[entry.originalIndex] = fromMetroFrame(
        metroFrame,
        frames[entry.originalIndex],
      );
    });

    return {
      status: 'complete',
      frames: mappedFrames,
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
