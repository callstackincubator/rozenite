import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState as CMEditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { cn } from '@rozenite/ui';
import { useEffect, useReducer, useRef, useState } from 'react';
import { compactAsciiPreview } from './binary';
import {
  initialState,
  reduce,
  type EditorMode,
} from './binary-value-editor-state';

export type BinaryValueEditorProps = {
  initialBytes?: number[];
  onChange: (bytes: number[] | null) => void;
};

// Pulls colors from the shared design tokens (set by `PluginShell` on its
// root as CSS custom properties) so the editor follows the active
// light/dark theme instead of being locked to one palette.
const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
    fontSize: '12px',
  },
  '.cm-content': {
    caretColor: 'var(--ring)',
    fontFamily: 'ui-monospace, "Cascadia Mono", "Fira Code", Menlo, monospace',
    padding: '8px',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-gutters': { display: 'none' },
  '.cm-scroller': { overflow: 'auto' },
});

const ModeButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    )}
  >
    {label}
  </button>
);

export const BinaryValueEditor = ({
  initialBytes,
  onChange,
}: BinaryValueEditorProps) => {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState({}),
  );
  const initialBytesRef = useRef(initialBytes);
  const [isPreparing, setIsPreparing] = useState(
    Boolean(initialBytesRef.current && initialBytesRef.current.length > 0),
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Formatting a complete binary editor document is unavoidable when editing,
  // but not when the dialog first opens. Yield once so the dialog can paint a
  // size-aware loading state before constructing a potentially huge document.
  useEffect(() => {
    const initialBytes = initialBytesRef.current;
    if (!initialBytes?.length) return;
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'replace-bytes', bytes: initialBytes });
      setIsPreparing(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Mount the CodeMirror view once. The update listener compares the
  // doc to the latest reducer text (via stateRef) so paste-or-type
  // events round-trip through the reducer instead of looping back.
  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const view = new EditorView({
      state: CMEditorState.create({
        doc: stateRef.current.text,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          editorTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const newText = update.state.doc.toString();
            if (newText === stateRef.current.text) return;
            const isPaste = update.transactions.some((tr) =>
              tr.isUserEvent('input.paste'),
            );
            dispatch({
              type: isPaste ? 'normalize-paste' : 'set-text',
              text: newText,
            });
          }),
        ],
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Push reducer text into CodeMirror only when they diverge.
  // This fires for paste normalization and mode switches.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === state.text) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: state.text },
    });
  }, [state.text]);

  useEffect(() => {
    onChangeRef.current(state.bytes);
  }, [state.bytes]);

  const byteCount = state.bytes?.length ?? initialBytes?.length ?? 0;
  const asciiPreview = state.bytes ? compactAsciiPreview(state.bytes) : '';

  const handleModeChange = (mode: EditorMode) => {
    if (state.mode === mode) return;
    dispatch({ type: 'switch-mode', mode });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <ModeButton
          label="Hex"
          active={state.mode === 'hex'}
          onClick={() => handleModeChange('hex')}
        />
        <ModeButton
          label="Base64"
          active={state.mode === 'base64'}
          onClick={() => handleModeChange('base64')}
        />
      </div>

      <div
        ref={hostRef}
        className="min-h-[120px] max-h-[300px] overflow-auto rounded-md border border-input bg-muted"
      />

      {isPreparing ? (
        <div className="text-xs text-muted-foreground">
          Preparing editor for {initialBytes?.length ?? 0} bytes…
        </div>
      ) : null}

      <div className="flex flex-col gap-1 text-xs">
        <div className="text-muted-foreground">{byteCount} bytes</div>
        {asciiPreview && (
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
            ASCII:{' '}
            <span className="font-mono text-foreground">{asciiPreview}</span>
          </div>
        )}
        {state.error && <div className="text-destructive">{state.error}</div>}
      </div>
    </div>
  );
};
