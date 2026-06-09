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

  const initialTrace: ReduxActionTrace = {
    rawStack,
    frames,
    status: 'pending',
  };

  const pendingTrace = symbolicateFrames(frames).then((outcome) => {
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
      traceCache.set(rawStack, trace);
    }

    return trace;
  });

  return { initialTrace, pendingTrace };
};
