import { useState } from 'react';
import { formatFrameLocation } from '../../react-native/symbolication/format';
import { classifyFrame } from '../../react-native/symbolication/rank';
import type { ActionOrigin, ActionStackFrame } from '../../react-native/symbolication/types';

export type DispatchOriginSectionProps = {
  origin: ActionOrigin | undefined;
};

const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin text-muted-foreground"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-75" />
  </svg>
);

const Headline = ({ origin }: { origin: ActionOrigin }) => {
  if (origin.symbolicationStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner />
        <span>Resolving origin from Metro…</span>
      </div>
    );
  }
  if (origin.symbolicationStatus === 'unavailable') {
    return (
      <div className="text-muted-foreground">
        Stack trace symbolication is unavailable (production build or Metro disconnected).
      </div>
    );
  }
  if (origin.symbolicationStatus === 'failed') {
    return (
      <div className="text-muted-foreground">
        <div>Could not source-map the stack via Metro.</div>
        {origin.symbolicationError && (
          <div className="mt-1 text-xs text-faint">{origin.symbolicationError}</div>
        )}
      </div>
    );
  }
  if (origin.confidence === 'none') {
    return <div className="text-warning">Could not resolve dispatch origin.</div>;
  }
  const location = formatFrameLocation(origin.originFrame);
  const fn = origin.originFrame?.functionName ?? '<anonymous>';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-foreground">
        Dispatched from <code className="font-mono text-info">{fn}</code> in{' '}
        <code className="font-mono text-info">{location ?? 'unknown location'}</code>
      </div>
      {origin.confidence === 'low' && (
        <span className="rounded-sm border border-warning/40 bg-warning-soft px-2 py-0.5 text-xs text-warning">
          low confidence
        </span>
      )}
    </div>
  );
};

const CodeFrame = ({ origin }: { origin: ActionOrigin }) => {
  if (!origin.codeFrame) return null;
  return (
    <pre
      className="mt-3 overflow-x-auto rounded-sm bg-surface p-2 font-mono text-xs text-muted-foreground"
      data-testid="dispatch-origin-code-frame"
    >
      {origin.codeFrame.content}
    </pre>
  );
};

const StackFrame = ({ frame, isOrigin }: { frame: ActionStackFrame; isOrigin: boolean }) => {
  const cls = classifyFrame(frame.url);
  const location = formatFrameLocation(frame);
  const fn = frame.functionName ?? '<anonymous>';
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-2 rounded-sm px-2 py-0.5 ${
        isOrigin ? 'border-l-2 border-primary bg-surface' : ''
      } ${cls === 'library' ? 'text-faint' : 'text-muted-foreground'}`}
    >
      <span className="font-mono">{location ?? frame.generatedUrl ?? '(no location)'}</span>
      <span className="text-faint">—</span>
      <span className="font-mono">{fn}</span>
      {cls === 'library' && (
        <span className="rounded-sm border border-border px-1 text-[10px] text-faint">library</span>
      )}
    </li>
  );
};

export const DispatchOriginSection = ({ origin }: DispatchOriginSectionProps) => {
  const initiallyExpanded =
    origin?.symbolicationStatus === 'complete' && origin?.confidence === 'none';
  const [isStackExpanded, setIsStackExpanded] = useState(initiallyExpanded);
  const [copied, setCopied] = useState(false);

  if (!origin) {
    return (
      <section className="mb-6">
        <h3 className="mb-3 text-base font-medium text-foreground">Dispatch Origin</h3>
        <div className="rounded-sm border border-border bg-muted p-3 text-sm text-muted-foreground">
          No stack trace captured for this action.
        </div>
      </section>
    );
  }

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(origin.rawStack);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can be denied in some iframe contexts; ignore.
    }
  };

  return (
    <section className="mb-6">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground">Dispatch Origin</h3>
        <button
          type="button"
          onClick={copyRaw}
          className="rounded-sm border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
          title="Copy raw stack"
        >
          {copied ? 'Copied' : 'Copy raw'}
        </button>
      </header>

      <div className="rounded-sm border border-border bg-muted p-3 text-sm">
        <Headline origin={origin} />
        {origin.symbolicationStatus === 'complete' && <CodeFrame origin={origin} />}

        {origin.frames.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIsStackExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={isStackExpanded}
            >
              <span>{isStackExpanded ? '▾' : '▸'}</span>
              <span>
                Full stack ({origin.frames.length} {origin.frames.length === 1 ? 'frame' : 'frames'}
                )
              </span>
            </button>
            {isStackExpanded && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {origin.frames.map((frame, idx) => (
                  <StackFrame key={idx} frame={frame} isOrigin={origin.originFrame === frame} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
