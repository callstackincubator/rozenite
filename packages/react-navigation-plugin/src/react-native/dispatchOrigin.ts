import {
  createSymbolicationCache,
  parseStack,
  pickOriginFrame,
  symbolicateFrames,
  type ActionOrigin,
  type ActionOriginCodeFrame,
  type ActionStackFrame,
  type SymbolicateOptions,
  type SymbolicationCache,
  type SymbolicationStatus,
} from './symbolication';

export type SymbolicatedCacheEntry = {
  frames: ActionStackFrame[];
  codeFrame?: ActionOriginCodeFrame;
};

export type DispatchOriginCache = SymbolicationCache<SymbolicatedCacheEntry>;

export const createDispatchOriginCache = (): DispatchOriginCache =>
  createSymbolicationCache<SymbolicatedCacheEntry>();

const buildOrigin = (
  rawStack: string,
  frames: ActionStackFrame[],
  status: SymbolicationStatus,
  options: { codeFrame?: ActionOriginCodeFrame; error?: string } = {},
): ActionOrigin => {
  const { frame: originFrame, confidence } = pickOriginFrame(frames);
  // The code-frame snippet only makes sense when it belongs to the same
  // file as the chosen origin frame; otherwise the UI would highlight a
  // location in one file and show a snippet from another.
  const codeFrame =
    options.codeFrame && originFrame?.url === options.codeFrame.fileName
      ? options.codeFrame
      : undefined;
  return {
    rawStack,
    frames,
    originFrame,
    confidence,
    symbolicationStatus: status,
    symbolicationError: options.error,
    codeFrame,
  };
};

export type ResolveDispatchOriginDeps = {
  cache: DispatchOriginCache;
  symbolicate?: typeof symbolicateFrames;
  symbolicateOptions?: SymbolicateOptions;
};

export type ResolveDispatchOriginResult = {
  initialOrigin: ActionOrigin;
  pendingResolution?: Promise<ActionOrigin>;
};

// Cache-hit fast path: return a `complete` origin synchronously.
// Cache-miss path: return a `pending` origin plus a promise that
// resolves to the post-symbolication origin (failed / unavailable /
// complete). Only successes are cached — failures retry on the next
// dispatch from the same callsite.
export const resolveDispatchOrigin = (
  rawStack: string,
  {
    cache,
    symbolicate = symbolicateFrames,
    symbolicateOptions,
  }: ResolveDispatchOriginDeps,
): ResolveDispatchOriginResult => {
  const frames = parseStack(rawStack);

  const cached = cache.get(rawStack);
  if (cached) {
    return {
      initialOrigin: buildOrigin(rawStack, cached.frames, 'complete', {
        codeFrame: cached.codeFrame,
      }),
    };
  }

  const initialOrigin = buildOrigin(rawStack, frames, 'pending');

  const pendingResolution = symbolicate(frames, symbolicateOptions ?? {}).then(
    (outcome) => {
      if (outcome.status === 'complete') {
        cache.set(rawStack, {
          frames: outcome.frames,
          codeFrame: outcome.codeFrame,
        });
        return buildOrigin(rawStack, outcome.frames, 'complete', {
          codeFrame: outcome.codeFrame,
        });
      }
      if (outcome.status === 'failed') {
        return buildOrigin(rawStack, frames, 'failed', {
          error: outcome.error,
        });
      }
      return buildOrigin(rawStack, frames, 'unavailable');
    },
  );

  return { initialOrigin, pendingResolution };
};
