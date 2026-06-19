import type { ReduxTraceFrame } from '../shared/trace';

const STACK_FRAME_LIMIT = 50;
const FRAME_LOCATION_PATTERN = /^(.*):(\d+):(\d+)$/;
const V8_FUNCTION_FRAME_PATTERN = /^at\s+(.*?)\s+\((.*)\)$/;
const V8_LOCATION_FRAME_PATTERN = /^at\s+(.*)$/;
const JSC_FRAME_PATTERN = /^(.*?)@(.*)$/;

const ANONYMOUS_FUNCTION_NAMES = new Set([
  '<anonymous>',
  'anonymous',
  '<unknown>',
]);

const normalizeFunctionName = (functionName?: string) => {
  const trimmed = functionName?.trim();

  return trimmed && !ANONYMOUS_FUNCTION_NAMES.has(trimmed)
    ? trimmed
    : undefined;
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

const parseLine = (line: string): ReduxTraceFrame | null => {
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

export const parseStack = (rawStack: string): ReduxTraceFrame[] =>
  rawStack
    .split('\n')
    .map(parseLine)
    .filter((frame): frame is ReduxTraceFrame => frame !== null)
    .slice(0, STACK_FRAME_LIMIT);
