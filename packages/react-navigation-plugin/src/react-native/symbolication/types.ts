export type ActionStackFrame = {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  generatedUrl?: string;
  generatedLineNumber?: number;
  generatedColumnNumber?: number;
  isCollapsed?: boolean;
};

export type SymbolicationStatus =
  | 'pending'
  | 'complete'
  | 'failed'
  | 'unavailable';

export type OriginConfidence = 'high' | 'low' | 'none';

export type ActionOriginCodeFrame = {
  fileName: string;
  content: string;
  line: number;
  column: number;
};

export type ActionOrigin = {
  rawStack: string;
  frames: ActionStackFrame[];
  originFrame?: ActionStackFrame;
  confidence: OriginConfidence;
  symbolicationStatus: SymbolicationStatus;
  symbolicationError?: string;
  codeFrame?: ActionOriginCodeFrame;
};
