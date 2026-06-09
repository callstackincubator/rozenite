export type ReduxTraceFrame = {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  generatedUrl?: string;
  generatedLineNumber?: number;
  generatedColumnNumber?: number;
  isCollapsed?: boolean;
};

export type ReduxTraceCodeFrame = {
  fileName: string;
  content: string;
  line: number;
  column: number;
};

export type ReduxTraceStatus =
  | 'pending'
  | 'complete'
  | 'failed'
  | 'unavailable';

export type ReduxActionTrace = {
  rawStack: string;
  frames: ReduxTraceFrame[];
  status: ReduxTraceStatus;
  error?: string;
  codeFrame?: ReduxTraceCodeFrame;
};

export type ReduxActionWithTrace = {
  stack?: string;
  rozeniteTrace?: ReduxActionTrace;
};
