import type { Initiator, InitiatorStackFrame } from '../../shared/client';

type ReactNativeStackFrame = {
  methodName: string;
  file: string | null | undefined;
  lineNumber: number | null | undefined;
  column: number | null | undefined;
  collapse?: boolean;
};

type SymbolicatedStackTrace = {
  stack: ReadonlyArray<ReactNativeStackFrame>;
  codeFrame?: Initiator['codeFrame'];
};

type SymbolicateStackTrace = (
  stack: ReadonlyArray<ReactNativeStackFrame>,
) => Promise<SymbolicatedStackTrace>;

const normalizeFunctionName = (functionName?: string) => {
  const trimmedFunctionName = functionName?.trim();

  return trimmedFunctionName &&
    trimmedFunctionName !== '<anonymous>' &&
    trimmedFunctionName !== 'anonymous' &&
    trimmedFunctionName !== '<unknown>'
    ? trimmedFunctionName
    : undefined;
};

const getGeneratedFrameLocation = (frame: InitiatorStackFrame) => ({
  url: frame.generatedUrl ?? frame.url,
  lineNumber: frame.generatedLineNumber ?? frame.lineNumber,
  columnNumber: frame.generatedColumnNumber ?? frame.columnNumber,
});

const isGeneratedBundleUrl = (url: string) =>
  /[^/]+\.bundle(?:[/?#]|$)/.test(url);

const isMetroSymbolicatableUrl = (url?: string) =>
  url?.startsWith('http') ?? false;

const canSymbolicateStack = (stack?: InitiatorStackFrame[]) =>
  stack?.some((frame) =>
    isMetroSymbolicatableUrl(getGeneratedFrameLocation(frame).url),
  ) ?? false;

const toReactNativeStackFrame = (
  frame: InitiatorStackFrame,
): ReactNativeStackFrame | null => {
  const generatedLocation = getGeneratedFrameLocation(frame);

  if (!isMetroSymbolicatableUrl(generatedLocation.url)) {
    return null;
  }

  return {
    methodName: frame.functionName ?? '<anonymous>',
    file: generatedLocation.url,
    lineNumber: generatedLocation.lineNumber,
    column: generatedLocation.columnNumber,
  };
};

const fromSymbolicatedStackFrame = (
  frame: ReactNativeStackFrame,
  generatedFrame: InitiatorStackFrame = {},
): InitiatorStackFrame => {
  const generatedLocation = getGeneratedFrameLocation(generatedFrame);
  const sourceUrl =
    frame.file &&
    frame.file !== generatedLocation.url &&
    !isGeneratedBundleUrl(frame.file)
      ? frame.file
      : undefined;

  return {
    functionName:
      normalizeFunctionName(frame.methodName) ?? generatedFrame.functionName,
    url: sourceUrl,
    lineNumber: sourceUrl ? (frame.lineNumber ?? undefined) : undefined,
    columnNumber: sourceUrl ? (frame.column ?? undefined) : undefined,
    generatedUrl: generatedLocation.url,
    generatedLineNumber: generatedLocation.lineNumber,
    generatedColumnNumber: generatedLocation.columnNumber,
    isCollapsed: frame.collapse,
  };
};

const getComparableSourcePath = (url?: string) =>
  url?.split(/[?#]/)[0].replace(/^file:\/\//, '');

const ANSI_SEQUENCE_PATTERN = new RegExp(
  [
    '[\\u001b\\u009b][[\\]()#;?]*',
    '(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
    '|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join(''),
  'g',
);

const stripAnsiSequences = (value: string) =>
  // Metro returns code frames formatted for terminals. DevTools renders them
  // as plain text, so terminal control sequences need to be removed.
  value.replace(ANSI_SEQUENCE_PATTERN, '');

const sanitizeCodeFrame = (
  codeFrame: Initiator['codeFrame'] | undefined,
) => {
  if (!codeFrame) {
    return null;
  }

  return {
    ...codeFrame,
    content: stripAnsiSequences(codeFrame.content),
  };
};

const isSameSourcePath = (left?: string, right?: string) => {
  const leftPath = getComparableSourcePath(left);
  const rightPath = getComparableSourcePath(right);

  if (!leftPath || !rightPath) {
    return false;
  }

  return leftPath.endsWith(rightPath) || rightPath.endsWith(leftPath);
};

const getSourceFrameForCodeFrame = (
  stack: InitiatorStackFrame[],
  codeFrame: Initiator['codeFrame'] | undefined,
) => {
  if (!codeFrame?.fileName) {
    return null;
  }

  return (
    stack.find((frame) => isSameSourcePath(codeFrame.fileName, frame.url)) ??
    null
  );
};

const getCodeFrameForSourceFrame = (
  codeFrame: Initiator['codeFrame'] | undefined,
  sourceFrame: InitiatorStackFrame | undefined,
) => {
  if (!codeFrame || !isSameSourcePath(codeFrame.fileName, sourceFrame?.url)) {
    return null;
  }

  return sanitizeCodeFrame(codeFrame);
};

const getPreferredSourceFrame = (
  stack: InitiatorStackFrame[],
  codeFrame: Initiator['codeFrame'] | undefined,
) =>
  getSourceFrameForCodeFrame(stack, codeFrame) ??
  stack.find((frame) => frame.url && !frame.isCollapsed) ??
  stack.find((frame) => frame.url) ??
  stack[0];

const getSymbolicationEndpoint = () => {
  if (typeof window === 'undefined') {
    throw new Error('Unable to resolve Metro symbolication endpoint');
  }

  return new URL('/symbolicate', window.location.origin).toString();
};

export const symbolicateStackTraceWithMetro: SymbolicateStackTrace = async (
  stack,
) => {
  const response = await fetch(getSymbolicationEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stack }),
  });

  if (!response.ok) {
    throw new Error(
      `Metro symbolication failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<SymbolicatedStackTrace>;
};

export const symbolicateInitiator = async (
  initiator: Initiator,
  symbolicateStackTrace: SymbolicateStackTrace = symbolicateStackTraceWithMetro,
): Promise<Initiator | null> => {
  if (!canSymbolicateStack(initiator.stack)) {
    return null;
  }

  const originalStack = initiator.stack ?? [];
  const generatedStackFrames = originalStack.flatMap(
    (originalFrame, originalIndex) => {
      const frame = toReactNativeStackFrame(originalFrame);
      return frame ? [{ frame, originalIndex }] : [];
    },
  );

  if (generatedStackFrames.length === 0) {
    return null;
  }

  try {
    const symbolicatedStackTrace = await symbolicateStackTrace(
      generatedStackFrames.map((entry) => entry.frame),
    );

    const symbolicatedFramesByOriginalIndex = new Map<
      number,
      InitiatorStackFrame
    >();

    symbolicatedStackTrace.stack.forEach((frame, index) => {
      const generatedFrame = generatedStackFrames[index];
      if (!generatedFrame) {
        return;
      }

      symbolicatedFramesByOriginalIndex.set(
        generatedFrame.originalIndex,
        fromSymbolicatedStackFrame(
          frame,
          originalStack[generatedFrame.originalIndex],
        ),
      );
    });

    const symbolicatedStack = originalStack.map(
      (frame, index) => symbolicatedFramesByOriginalIndex.get(index) ?? frame,
    );
    const sourceFrame = getPreferredSourceFrame(
      symbolicatedStack,
      symbolicatedStackTrace.codeFrame,
    );
    const hasSourceMappedFrame = symbolicatedStack.some((frame) => frame.url);

    return {
      ...initiator,
      type: sourceFrame?.url ? 'script' : initiator.type,
      functionName: sourceFrame?.functionName,
      url: sourceFrame?.url,
      lineNumber: sourceFrame?.lineNumber,
      columnNumber: sourceFrame?.columnNumber,
      generatedUrl: sourceFrame?.generatedUrl ?? initiator.generatedUrl,
      generatedLineNumber:
        sourceFrame?.generatedLineNumber ?? initiator.generatedLineNumber,
      generatedColumnNumber:
        sourceFrame?.generatedColumnNumber ?? initiator.generatedColumnNumber,
      stack: symbolicatedStack,
      codeFrame: getCodeFrameForSourceFrame(
        symbolicatedStackTrace.codeFrame,
        sourceFrame,
      ),
      symbolicationStatus: hasSourceMappedFrame ? 'complete' : 'unavailable',
      symbolicationError: undefined,
    };
  } catch (error) {
    return {
      ...initiator,
      symbolicationStatus: 'failed',
      symbolicationError:
        error instanceof Error ? error.message : 'Unable to symbolicate stack',
    };
  }
};
