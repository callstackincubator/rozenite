import type { ActionStackFrame, OriginConfidence } from './types';

export type FrameClass = 'app' | 'library' | 'unknown';

// Match "node_modules/" at the start of the path OR preceded by a
// slash. Captures both absolute paths (`/abs/.../node_modules/react/`)
// and relative ones (`node_modules/react/index.js`).
const NODE_MODULES_PATTERN = /(?:^|\/)node_modules\//;

export const classifyFrame = (url: string | undefined): FrameClass => {
  if (!url) return 'unknown';
  return NODE_MODULES_PATTERN.test(url) ? 'library' : 'app';
};

export type OriginPick = {
  frame: ActionStackFrame | undefined;
  confidence: OriginConfidence;
};

// Prefers the first source-mapped app frame. Falls back to the first
// frame with any source-mapped URL (library), then to the first frame
// at all (which may have only a generated URL). The three confidence
// states let the UI distinguish "clearly your code" from "best we
// could do" from "we don't really know".
export const pickOriginFrame = (frames: ActionStackFrame[]): OriginPick => {
  const firstApp = frames.find((f) => classifyFrame(f.url) === 'app');
  if (firstApp) return { frame: firstApp, confidence: 'high' };

  const firstWithSource = frames.find((f) => f.url);
  if (firstWithSource) return { frame: firstWithSource, confidence: 'low' };

  return { frame: frames[0], confidence: 'none' };
};
