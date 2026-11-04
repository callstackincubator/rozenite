/**
 * Stack traces captured on the device, symbolicated here through the Metro
 * server that serves this panel (`/symbolicate`).
 */

export type TraceFrame = {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  generatedUrl?: string;
  generatedLineNumber?: number;
  generatedColumnNumber?: number;
  isCollapsed?: boolean;
};

export type TraceCodeFrame = {
  fileName: string;
  content: string;
  line: number;
  column: number;
};

export type Trace = {
  frames: TraceFrame[];
  status: 'complete' | 'failed' | 'unavailable';
  error?: string;
  codeFrame?: TraceCodeFrame;
};

const STACK_FRAME_LIMIT = 50;
const FRAME_LOCATION_PATTERN = /^(.*):(\d+):(\d+)$/;
const V8_FUNCTION_FRAME_PATTERN = /^at\s+(.*?)\s+\((.*)\)$/;
const V8_LOCATION_FRAME_PATTERN = /^at\s+(.*)$/;
const JSC_FRAME_PATTERN = /^(.*?)@(.*)$/;

const ANONYMOUS_FUNCTION_NAMES = new Set(['<anonymous>', 'anonymous', '<unknown>']);

const normalizeFunctionName = (functionName?: string) => {
  const trimmed = functionName?.trim();

  return trimmed && !ANONYMOUS_FUNCTION_NAMES.has(trimmed) ? trimmed : undefined;
};

const parseLocation = (location: string) => {
  const match = location.match(FRAME_LOCATION_PATTERN);
  if (!match) {
    return null;
  }

  return {
    url: match[1],
    lineNumber: Number.parseInt(match[2], 10),
    columnNumber: Number.parseInt(match[3], 10),
  };
};

const parseLine = (line: string): TraceFrame | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'Error') {
    return null;
  }

  let functionName: string | undefined;
  let location: string | undefined;

  const v8FunctionMatch = trimmed.match(V8_FUNCTION_FRAME_PATTERN);
  if (v8FunctionMatch) {
    functionName = v8FunctionMatch[1];
    location = v8FunctionMatch[2];
  } else {
    const v8LocationMatch = trimmed.match(V8_LOCATION_FRAME_PATTERN);
    if (v8LocationMatch) {
      location = v8LocationMatch[1];
    } else {
      const jscMatch = trimmed.match(JSC_FRAME_PATTERN);
      if (jscMatch) {
        functionName = jscMatch[1];
        location = jscMatch[2];
      }
    }
  }

  if (!location) {
    return null;
  }

  const parsed = parseLocation(location);
  if (!parsed) {
    return null;
  }

  return {
    functionName: normalizeFunctionName(functionName),
    generatedUrl: parsed.url,
    generatedLineNumber: parsed.lineNumber,
    generatedColumnNumber: parsed.columnNumber,
  };
};

export const parseStack = (rawStack: string): TraceFrame[] =>
  rawStack
    .split('\n')
    .map(parseLine)
    .filter((frame): frame is TraceFrame => frame !== null)
    .slice(0, STACK_FRAME_LIMIT);

type MetroFrame = {
  methodName: string;
  file: string | null | undefined;
  lineNumber: number | null | undefined;
  column: number | null | undefined;
  collapse?: boolean;
};

type MetroCodeFrame = {
  fileName: string;
  content: string;
  location?: { row: number; column: number };
};

const isBundleUrl = (url: string | undefined) => !!url && /[^/]+\.bundle(?:[/?#]|$)/.test(url);

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

const fromMetroFrame = (metro: MetroFrame, original: TraceFrame): TraceFrame => {
  const url =
    metro.file && metro.file !== original.generatedUrl && !isBundleUrl(metro.file)
      ? metro.file
      : undefined;
  return {
    ...original,
    functionName:
      metro.methodName && !ANONYMOUS_FUNCTION_NAMES.has(metro.methodName)
        ? metro.methodName
        : original.functionName,
    url,
    lineNumber: url ? (metro.lineNumber ?? undefined) : undefined,
    columnNumber: url ? (metro.column ?? undefined) : undefined,
    isCollapsed: metro.collapse,
  };
};

/** Parses a raw device stack and maps its bundle locations to source files. */
export const symbolicateStack = async (
  rawStack: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Trace> => {
  const frames = parseStack(rawStack);
  const sendable = frames.flatMap((frame, index) =>
    frame.generatedUrl?.startsWith('http') ? [{ frame, index }] : [],
  );
  if (sendable.length === 0 || typeof window === 'undefined') {
    return { frames, status: 'unavailable' };
  }
  try {
    const response = await fetchImpl(new URL('/symbolicate', window.location.origin).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stack: sendable.map(({ frame }) => ({
          methodName: frame.functionName ?? '<anonymous>',
          file: frame.generatedUrl,
          lineNumber: frame.generatedLineNumber,
          column: frame.generatedColumnNumber,
        })),
      }),
    });
    if (!response.ok) {
      return { frames, status: 'failed', error: `Metro responded with HTTP ${response.status}` };
    }
    const data = (await response.json()) as { stack?: MetroFrame[]; codeFrame?: MetroCodeFrame };
    if (!Array.isArray(data?.stack)) {
      return { frames, status: 'failed', error: 'Metro returned an unexpected response' };
    }
    const mapped = [...frames];
    data.stack.forEach((metro, position) => {
      const entry = sendable[position];
      if (entry) mapped[entry.index] = fromMetroFrame(metro, entry.frame);
    });
    const code = data.codeFrame;
    return {
      frames: mapped,
      status: 'complete',
      codeFrame: code?.location
        ? {
            fileName: code.fileName,
            content: stripAnsi(code.content),
            line: code.location.row,
            column: code.location.column,
          }
        : undefined,
    };
  } catch (error) {
    return { frames, status: 'failed', error: (error as Error).message };
  }
};
