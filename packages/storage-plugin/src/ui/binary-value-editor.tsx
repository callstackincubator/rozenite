import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState as CMEditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useReducer, useRef } from 'react';
import { bytesToAsciiPreview } from './binary';
import {
  initialState,
  reduce,
  type EditorMode,
} from './binary-value-editor-state';

export type BinaryValueEditorProps = {
  initialBytes?: number[];
  onChange: (bytes: number[] | null) => void;
};

const darkTheme = EditorView.theme(
  {
    '&': {
      color: '#e5e7eb',
      backgroundColor: '#111827',
      fontSize: '12px',
    },
    '.cm-content': {
      caretColor: '#60a5fa',
      fontFamily:
        'ui-monospace, "Cascadia Mono", "Fira Code", Menlo, monospace',
      padding: '8px',
    },
    '.cm-focused': { outline: 'none' },
    '.cm-gutters': { display: 'none' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
);

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
    className={`rounded px-2 py-1 text-xs transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
    }`}
  >
    {label}
  </button>
);

export const BinaryValueEditor = ({
  initialBytes,
  onChange,
}: BinaryValueEditorProps) => {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState({ initialBytes }),
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
          darkTheme,
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

  const byteCount = state.bytes?.length ?? 0;
  const asciiPreview = state.bytes ? bytesToAsciiPreview(state.bytes) : '';

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
        className="min-h-[120px] max-h-[300px] overflow-auto rounded border border-gray-700 bg-gray-900"
      />

      <div className="flex flex-col gap-1 text-xs">
        <div className="text-gray-400">{byteCount} bytes</div>
        {asciiPreview && (
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-gray-300">
            {asciiPreview}
          </div>
        )}
        {state.error && <div className="text-red-400">{state.error}</div>}
      </div>
    </div>
  );
};
