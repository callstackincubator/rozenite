import type { ReduxActionTrace } from '../shared/trace';
import { parseStack } from './parse';
import { symbolicateFrames } from './metro';

export type ResolveReduxTraceOptions = {
  symbolicate?: boolean;
};

export type ResolveReduxTraceResult = {
  initialTrace: ReduxActionTrace;
  pendingTrace?: Promise<ReduxActionTrace>;
};

const traceCache = new Map<string, ReduxActionTrace>();
const pendingTraceCache = new Map<string, Promise<ReduxActionTrace>>();
const MAX_TRACE_CACHE_SIZE = 500;

const setCachedTrace = (rawStack: string, trace: ReduxActionTrace): void => {
  traceCache.set(rawStack, trace);

  if (traceCache.size <= MAX_TRACE_CACHE_SIZE) {
    return;
  }

  const oldestKey = traceCache.keys().next().value;
  if (oldestKey) {
    traceCache.delete(oldestKey);
  }
};

export const resolveReduxTrace = (
  rawStack: string,
  options: ResolveReduxTraceOptions = {},
): ResolveReduxTraceResult => {
  const cached = traceCache.get(rawStack);
  if (cached) {
    return { initialTrace: cached };
  }

  const frames = parseStack(rawStack);
  const shouldSymbolicate = options.symbolicate ?? true;

  if (!shouldSymbolicate || frames.length === 0) {
    return {
      initialTrace: {
        rawStack,
        frames,
        status: 'unavailable',
      },
    };
  }

  const pendingTrace = pendingTraceCache.get(rawStack);
  if (pendingTrace) {
    return {
      initialTrace: {
        rawStack,
        frames,
        status: 'pending',
      },
      pendingTrace,
    };
  }

  const initialTrace: ReduxActionTrace = {
    rawStack,
    frames,
    status: 'pending',
  };

  const nextPendingTrace = symbolicateFrames(frames)
    .then((outcome) => {
      const trace: ReduxActionTrace =
        outcome.status === 'complete'
          ? {
              rawStack,
              frames: outcome.frames,
              status: 'complete',
              codeFrame: outcome.codeFrame,
            }
          : outcome.status === 'failed'
            ? {
                rawStack,
                frames: outcome.frames,
                status: 'failed',
                error: outcome.error,
              }
            : {
                rawStack,
                frames: outcome.frames,
                status: 'unavailable',
              };

      if (trace.status === 'complete') {
        setCachedTrace(rawStack, trace);
      }

      return trace;
    })
    .finally(() => {
      pendingTraceCache.delete(rawStack);
    });

  pendingTraceCache.set(rawStack, nextPendingTrace);

  return { initialTrace, pendingTrace: nextPendingTrace };
};
