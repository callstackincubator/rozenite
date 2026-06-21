import { useState } from 'react';
import { formatFrameLocation } from '../../react-native/symbolication/format';
import { classifyFrame } from '../../react-native/symbolication/rank';
import type {
  ActionOrigin,
  ActionStackFrame,
} from '../../react-native/symbolication/types';

export type DispatchOriginSectionProps = {
  origin: ActionOrigin | undefined;
};

const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin text-muted"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      className="opacity-25"
    />
    <path
      d="M4 12a8 8 0 018-8"
      stroke="currentColor"
      strokeWidth="3"
      className="opacity-75"
    />
  </svg>
);

const Headline = ({ origin }: { origin: ActionOrigin }) => {
  if (origin.symbolicationStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 text-foreground">
        <Spinner />
        <span>Resolving origin from Metro…</span>
      </div>
    );
  }
  if (origin.symbolicationStatus === 'unavailable') {
    return (
      <div className="text-muted">
        Stack trace symbolication is unavailable (production build or Metro
        disconnected).
      </div>
    );
  }
  if (origin.symbolicationStatus === 'failed') {
    return (
      <div className="text-foreground">
        <div>Could not source-map the stack via Metro.</div>
        {origin.symbolicationError && (
          <div className="mt-1 text-xs text-muted">
            {origin.symbolicationError}
          </div>
        )}
      </div>
    );
  }
  if (origin.confidence === 'none') {
    return (
      <div className="text-orange-400">Could not resolve dispatch origin.</div>
    );
  }
  const location = formatFrameLocation(origin.originFrame);
  const fn = origin.originFrame?.functionName ?? '<anonymous>';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-foreground">
        Dispatched from <code className="font-mono text-accent">{fn}</code> in{' '}
        <code className="font-mono text-accent">
          {location ?? 'unknown location'}
        </code>
      </div>
      {origin.confidence === 'low' && (
        <span className="rounded border border-yellow-700 bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-300">
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
      className="mt-3 overflow-x-auto rounded bg-surface-secondary p-2 font-mono text-xs text-foreground"
      data-testid="dispatch-origin-code-frame"
    >
      {origin.codeFrame.content}
    </pre>
  );
};

const StackFrame = ({
  frame,
  isOrigin,
}: {
  frame: ActionStackFrame;
  isOrigin: boolean;
}) => {
  const cls = classifyFrame(frame.url);
  const location = formatFrameLocation(frame);
  const fn = frame.functionName ?? '<anonymous>';
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-2 rounded-sm px-2 py-0.5 ${
        isOrigin ? 'border-l-2 border-blue-500 bg-surface-secondary' : ''
      } ${cls === 'library' ? 'text-muted' : 'text-foreground'}`}
    >
      <span className="font-mono">
        {location ?? frame.generatedUrl ?? '(no location)'}
      </span>
      <span className="text-muted">—</span>
      <span className="font-mono">{fn}</span>
      {cls === 'library' && (
        <span className="rounded border border-border/70 px-1 text-[10px] text-muted">
          library
        </span>
      )}
    </li>
  );
};

export const DispatchOriginSection = ({
  origin,
}: DispatchOriginSectionProps) => {
  const initiallyExpanded =
    origin?.symbolicationStatus === 'complete' && origin?.confidence === 'none';
  const [isStackExpanded, setIsStackExpanded] = useState(initiallyExpanded);
  const [copied, setCopied] = useState(false);

  if (!origin) {
    return (
      <section>
        <h3 className="mb-3 text-base font-bold text-foreground">
          Dispatch Origin
        </h3>
        <div className="rounded border border-border/70 bg-surface-secondary p-3 text-sm text-muted">
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
    <section>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Dispatch Origin</h3>
        <button
          type="button"
          onClick={copyRaw}
          className="rounded border border-border/70 bg-surface-secondary px-2 py-1 text-xs text-foreground transition-colors hover:bg-surface-tertiary"
          title="Copy raw stack"
        >
          {copied ? 'Copied' : 'Copy raw'}
        </button>
      </header>

      <div className="rounded border border-border/70 bg-surface-secondary p-3 text-sm">
        <Headline origin={origin} />
        {origin.symbolicationStatus === 'complete' && (
          <CodeFrame origin={origin} />
        )}

        {origin.frames.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIsStackExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              aria-expanded={isStackExpanded}
            >
              <span>{isStackExpanded ? '▾' : '▸'}</span>
              <span>
                Full stack ({origin.frames.length}{' '}
                {origin.frames.length === 1 ? 'frame' : 'frames'})
              </span>
            </button>
            {isStackExpanded && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {origin.frames.map((frame, idx) => (
                  <StackFrame
                    key={idx}
                    frame={frame}
                    isOrigin={origin.originFrame === frame}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
