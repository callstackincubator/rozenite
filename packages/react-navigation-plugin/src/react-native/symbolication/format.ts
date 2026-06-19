import type { ActionStackFrame } from './types';

// Workspace-style path matchers — surface the part of the file path
// that's meaningful to a developer. Monorepos commonly have `apps/`,
// `packages/`, and `src/` roots; falling back to the last few segments
// covers everything else.
const WORKSPACE_PATH_PATTERN = /(?:^|\/)((?:apps|packages|src)\/.+)$/;

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const formatSourcePath = (url: string): string => {
  const withoutQueryAndHash = url.split(/[?#]/)[0];
  const decoded = safeDecodeURIComponent(withoutQueryAndHash).replace(
    /^file:\/\//,
    '',
  );

  // For Metro bundle URLs, the bundle filename is the meaningful suffix.
  const bundleMatch = decoded.match(/([^/]+\.bundle)(?:\/|$)/);
  if (bundleMatch) return bundleMatch[1];

  const workspaceMatch = decoded.match(WORKSPACE_PATH_PATTERN);
  if (workspaceMatch) return workspaceMatch[1];

  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split('/').filter(Boolean).pop();
    return fileName || parsed.hostname || url;
  } catch {
    const segments = decoded.split('/').filter(Boolean);
    return segments.slice(-3).join('/') || decoded || url;
  }
};

export const formatFrameLocation = (
  frame: ActionStackFrame | undefined,
): string | null => {
  const url = frame?.url ?? frame?.generatedUrl;
  if (!url) return null;

  const parts = [formatSourcePath(url)];
  const line = frame?.url ? frame.lineNumber : frame?.generatedLineNumber;
  const column = frame?.url ? frame.columnNumber : frame?.generatedColumnNumber;
  if (line !== undefined) parts.push(String(line));
  if (column !== undefined) parts.push(String(column));
  return parts.join(':');
};
