import type { CSSProperties } from 'react';
import type { Action } from 'redux';
import type { TabComponentProps } from '@redux-devtools/inspector-monitor';
import type {
  ReduxActionTrace,
  ReduxActionWithTrace,
  ReduxTraceFrame,
} from '../shared/trace';

type LiftedActionWithTrace<A extends Action<string>> = {
  action?: A;
} & ReduxActionWithTrace;

const rootStyle: CSSProperties = {
  padding: '8px 12px',
  fontFamily: 'Consolas, Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.45,
  overflow: 'auto',
  height: '100%',
  boxSizing: 'border-box',
};

const mutedStyle: CSSProperties = {
  color: '#8f9aa8',
};

const statusStyle: CSSProperties = {
  marginBottom: 10,
  color: '#8f9aa8',
};

const frameStyle: CSSProperties = {
  padding: '5px 0',
  borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
};

const functionStyle: CSSProperties = {
  color: '#d7dde7',
};

const appLocationStyle: CSSProperties = {
  color: '#8bd5ff',
  wordBreak: 'break-all',
};

const libraryLocationStyle: CSSProperties = {
  color: '#9ca3af',
  wordBreak: 'break-all',
};

const codeFrameStyle: CSSProperties = {
  margin: '10px 0 12px',
  padding: 10,
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: 6,
  overflow: 'auto',
  color: '#d7dde7',
  background: 'rgba(15, 23, 42, 0.55)',
};

const detailsStyle: CSSProperties = {
  marginTop: 12,
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: '#cbd5e1',
};

const rawStackStyle: CSSProperties = {
  marginTop: 8,
  whiteSpace: 'pre-wrap',
  color: '#9ca3af',
};

const NODE_MODULES_PATTERN = /(?:^|\/)node_modules\//;

const getLiftedAction = <A extends Action<string>>({
  actions,
  selectedActionId,
  action,
}: TabComponentProps<unknown, A>): LiftedActionWithTrace<A> | undefined => {
  if (selectedActionId != null) {
    return actions[selectedActionId] as LiftedActionWithTrace<A> | undefined;
  }

  return Object.values(actions).find(
    (liftedAction) => liftedAction.action === action,
  ) as LiftedActionWithTrace<A> | undefined;
};

const parseRawStackFallback = (rawStack: string): ReduxTraceFrame[] =>
  rawStack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== 'Error')
    .slice(0, 50)
    .map((line) => ({
      generatedUrl: line,
    }));

const getTrace = <A extends Action<string>>(
  liftedAction: LiftedActionWithTrace<A> | undefined,
): ReduxActionTrace | undefined => {
  if (liftedAction?.rozeniteTrace) {
    return liftedAction.rozeniteTrace;
  }

  if (typeof liftedAction?.stack === 'string') {
    return {
      rawStack: liftedAction.stack,
      frames: parseRawStackFallback(liftedAction.stack),
      status: 'unavailable',
    };
  }

  return undefined;
};

const formatSourcePath = (url: string): string => {
  const withoutQueryAndHash = url.split(/[?#]/)[0];
  const decoded = safeDecodeURIComponent(withoutQueryAndHash).replace(
    /^file:\/\//,
    '',
  );
  const workspaceMatch = decoded.match(/(?:^|\/)((?:apps|packages|src)\/.+)$/);

  if (workspaceMatch) {
    return workspaceMatch[1];
  }

  const bundleMatch = decoded.match(/([^/]+\.bundle)(?:\/|$)/);
  if (bundleMatch) {
    return bundleMatch[1];
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
  } catch {
    const segments = decoded.split('/').filter(Boolean);
    return segments.slice(-3).join('/') || decoded || url;
  }
};

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const formatLocation = (frame: ReduxTraceFrame): string => {
  const url = frame.url ?? frame.generatedUrl;
  if (!url) {
    return '(unknown source)';
  }

  const line = frame.url ? frame.lineNumber : frame.generatedLineNumber;
  const column = frame.url ? frame.columnNumber : frame.generatedColumnNumber;
  const parts = [formatSourcePath(url)];

  if (line !== undefined) {
    parts.push(String(line));
  }

  if (column !== undefined) {
    parts.push(String(column));
  }

  return parts.join(':');
};

const isLibraryFrame = (frame: ReduxTraceFrame): boolean => {
  const source = frame.url ?? frame.generatedUrl;
  return source ? NODE_MODULES_PATTERN.test(source) : true;
};

const getFunctionName = (frame: ReduxTraceFrame): string =>
  frame.functionName ?? '(anonymous function)';

const FrameList = ({
  frames,
  dimLibraries,
}: {
  frames: ReduxTraceFrame[];
  dimLibraries?: boolean;
}) => {
  if (frames.length === 0) {
    return <div style={mutedStyle}>No stack frames could be parsed.</div>;
  }

  return (
    <div>
      {frames.map((frame, index) => {
        const isLibrary = isLibraryFrame(frame);
        return (
          <div key={`${formatLocation(frame)}-${index}`} style={frameStyle}>
            <div style={functionStyle}>{getFunctionName(frame)}</div>
            <div
              style={
                dimLibraries && isLibrary
                  ? libraryLocationStyle
                  : appLocationStyle
              }
            >
              {formatLocation(frame)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CodeFrame = ({ trace }: { trace: ReduxActionTrace }) => {
  if (!trace.codeFrame) {
    return null;
  }

  return (
    <pre style={codeFrameStyle}>
      {trace.codeFrame.fileName}:{trace.codeFrame.line}:{trace.codeFrame.column}
      {'\n\n'}
      {trace.codeFrame.content}
    </pre>
  );
};

const Status = ({ trace }: { trace: ReduxActionTrace }) => {
  if (trace.status === 'pending') {
    return <div style={statusStyle}>Symbolicating stack trace with Metro...</div>;
  }

  if (trace.status === 'failed') {
    return (
      <div style={statusStyle}>
        Could not source-map the stack via Metro: {trace.error}
      </div>
    );
  }

  if (trace.status === 'unavailable') {
    return (
      <div style={statusStyle}>
        Stack trace symbolication is unavailable for this action.
      </div>
    );
  }

  return <div style={statusStyle}>Symbolicated stack trace</div>;
};

export const TraceTab = <S, A extends Action<string>>(
  props: TabComponentProps<S, A>,
) => {
  const liftedAction = getLiftedAction(
    props as unknown as TabComponentProps<unknown, A>,
  );
  const trace = getTrace(liftedAction);

  if (!trace) {
    return (
      <div style={rootStyle}>
        To enable tracing action calls, set the `trace` option to `true` for
        `rozeniteDevToolsEnhancer`.
      </div>
    );
  }

  const appFrames = trace.frames.filter((frame) => !isLibraryFrame(frame));
  const preferredFrames = appFrames.length > 0 ? appFrames : trace.frames;

  return (
    <div style={rootStyle}>
      <Status trace={trace} />
      <CodeFrame trace={trace} />
      <FrameList frames={preferredFrames} dimLibraries />
      {preferredFrames.length !== trace.frames.length && (
        <details style={detailsStyle}>
          <summary style={summaryStyle}>
            Full stack ({trace.frames.length} frames)
          </summary>
          <FrameList frames={trace.frames} dimLibraries />
        </details>
      )}
      <details style={detailsStyle}>
        <summary style={summaryStyle}>Raw stack</summary>
        <pre style={rawStackStyle}>{trace.rawStack}</pre>
      </details>
    </div>
  );
};

export default TraceTab;
