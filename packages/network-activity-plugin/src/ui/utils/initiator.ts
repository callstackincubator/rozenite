import type { Initiator, InitiatorStackFrame } from '../../shared/client';

type FrameLocation = {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
};

const SOURCE_PATH_PATTERN = /(?:^|\/)((?:apps|packages|src)\/.+)$/;

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getGeneratedFrameLocation = (
  frame?: InitiatorStackFrame | Initiator,
): FrameLocation | null => {
  if (!frame?.generatedUrl) {
    return null;
  }

  return {
    functionName: frame.functionName,
    url: frame.generatedUrl,
    lineNumber: frame.generatedLineNumber,
    columnNumber: frame.generatedColumnNumber,
  };
};

export const getSourceFrameLocation = (
  frame?: InitiatorStackFrame | Initiator,
): FrameLocation | null => {
  if (!frame?.url) {
    return null;
  }

  return {
    functionName: frame.functionName,
    url: frame.url,
    lineNumber: frame.lineNumber,
    columnNumber: frame.columnNumber,
  };
};

export const formatSourcePath = (url: string) => {
  const withoutQuery = url.split(/[?#]/)[0];
  const decodedPath = safeDecodeURIComponent(withoutQuery).replace(
    /^file:\/\//,
    '',
  );
  const bundlePathMatch = decodedPath.match(/([^/]+\.bundle)(?:\/|$)/);

  if (bundlePathMatch) {
    return bundlePathMatch[1];
  }

  const sourcePathMatch = decodedPath.match(SOURCE_PATH_PATTERN);

  if (sourcePathMatch) {
    return sourcePathMatch[1];
  }

  try {
    const parsedUrl = new URL(url);
    const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop();

    return fileName || parsedUrl.hostname || url;
  } catch {
    const pathParts = decodedPath.split('/').filter(Boolean);

    return pathParts.slice(-3).join('/') || decodedPath || url;
  }
};

export const formatFrameLocation = (frame?: FrameLocation | null) => {
  if (!frame?.url) {
    return null;
  }

  const locationParts = [formatSourcePath(frame.url)];
  if (frame.lineNumber !== undefined) {
    locationParts.push(String(frame.lineNumber));
  }
  if (frame.columnNumber !== undefined) {
    locationParts.push(String(frame.columnNumber));
  }

  return locationParts.join(':');
};

export const getBestInitiatorFrame = (
  initiator?: Initiator,
): FrameLocation | null => {
  const directSourceFrame = getSourceFrameLocation(initiator);
  if (directSourceFrame) {
    return directSourceFrame;
  }

  const stackSourceFrame =
    initiator?.stack
      ?.filter((frame) => !frame.isCollapsed)
      .map(getSourceFrameLocation)
      .find((frame): frame is FrameLocation => frame !== null) ?? null;

  return stackSourceFrame ?? getGeneratedFrameLocation(initiator);
};

export const getInitiatorLabel = (initiator?: Initiator) => {
  if (!initiator) {
    return null;
  }

  if (initiator.symbolicationStatus === 'pending') {
    return 'Resolving source...';
  }

  const bestFrame = getBestInitiatorFrame(initiator);
  if (!bestFrame) {
    return null;
  }

  return (
    bestFrame.functionName ??
    formatFrameLocation(bestFrame) ??
    (bestFrame.url ? formatSourcePath(bestFrame.url) : null)
  );
};

export const getInitiatorLocationLabel = (initiator?: Initiator) => {
  return formatFrameLocation(getBestInitiatorFrame(initiator));
};
