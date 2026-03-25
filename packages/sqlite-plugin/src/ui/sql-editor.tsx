import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionSource,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  schemaCompletionSource,
  sql,
  SQLite,
  type SQLNamespace,
} from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from '@codemirror/state';
import { searchKeymap } from '@codemirror/search';
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from 'react';

export type SqlEditorHandle = {
  focus: () => void;
  getSelection: () => { start: number; end: number };
};

type SqlEditorProps = {
  ariaLabel: string;
  completionSchema: SQLNamespace;
  completionSource?: CompletionSource;
  defaultSchema?: string;
  defaultTable?: string;
  errorLine: number | null;
  onFormat: () => void;
  onRun: () => void;
  onRunCurrent: () => void;
  onSave: () => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  onValueChange: (value: string) => void;
  placeholderText: string;
  readOnly?: boolean;
  value: string;
};

const sqlSupportCompartment = new Compartment();
const autocompleteCompartment = new Compartment();
const errorLineCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const editableCompartment = new Compartment();

const emptyDecorations = Decoration.set([]);
const sqlHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword],
    color: '#8ec5ff',
    fontWeight: '600',
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: '#8fe0ba',
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.bool],
    color: '#f9c97a',
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'rgba(165, 185, 204, 0.56)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.name, tags.variableName, tags.propertyName],
    color: '#edf5fb',
  },
  {
    tag: [tags.definition(tags.name), tags.typeName, tags.namespace],
    color: '#9ecbff',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: '#7fd8ff',
  },
  {
    tag: [tags.operator, tags.compareOperator, tags.logicOperator],
    color: 'rgba(190, 216, 238, 0.88)',
  },
  {
    tag: tags.null,
    color: '#ff9f7f',
  },
  {
    tag: [tags.paren, tags.squareBracket, tags.brace, tags.punctuation],
    color: 'rgba(226, 236, 245, 0.82)',
  },
]);

const sqlEditorTheme = EditorView.theme(
  {
    '&': {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      color: 'var(--sqlite-text)',
      backgroundColor: 'transparent',
      fontSize: '0.8rem',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: '0',
      fontFamily:
        "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace",
    },
    '.cm-sizer': {
      minHeight: '100%',
      minWidth: '100%',
      flex: '1 1 auto',
    },
    '.cm-content': {
      minHeight: '100%',
      caretColor: '#f7fbff',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#f7fbff',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection':
      {
        backgroundColor: 'rgba(89, 163, 255, 0.2)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.032)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.028)',
      color: 'rgba(244, 249, 253, 0.96)',
    },
    '.cm-gutters': {
      color: 'rgba(165, 185, 204, 0.5)',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRight: '1px solid var(--sqlite-line)',
    },
    '.cm-tooltip': {
      border: '1px solid var(--sqlite-line-strong)',
      backgroundColor: 'rgba(10, 20, 31, 0.98)',
      color: 'var(--sqlite-text)',
      borderRadius: '0.9rem',
      boxShadow: '0 20px 52px rgba(0, 0, 0, 0.34)',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(89, 163, 255, 0.18)',
      color: '#fff',
    },
    '.cm-panels': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      color: 'var(--sqlite-text)',
      borderBottom: '1px solid var(--sqlite-line)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 191, 105, 0.2)',
      outline: '1px solid rgba(255, 191, 105, 0.22)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(89, 163, 255, 0.26)',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      outline: '1px solid rgba(255, 255, 255, 0.08)',
    },
  },
  { dark: true },
);

const createErrorLineExtension = (errorLine: number | null): Extension => {
  if (!errorLine) {
    return EditorView.decorations.of(emptyDecorations);
  }

  return EditorView.decorations.of((view) => {
    if (errorLine < 1 || errorLine > view.state.doc.lines) {
      return emptyDecorations;
    }

    const line = view.state.doc.line(errorLine);
    return Decoration.set([
      Decoration.line({
        attributes: { class: 'cm-sqlite-errorLine' },
      }).range(line.from),
    ]);
  });
};

const createAutocompleteExtension = ({
  completionSchema,
  completionSource,
  defaultSchema,
  defaultTable,
}: Pick<
  SqlEditorProps,
  'completionSchema' | 'completionSource' | 'defaultSchema' | 'defaultTable'
>): Extension => {
  const sources = [
    completionSource,
    schemaCompletionSource({
      defaultSchema,
      defaultTable,
      dialect: SQLite,
      schema: completionSchema,
      upperCaseKeywords: true,
    }),
  ].filter(Boolean) as CompletionSource[];

  return autocompletion({
    activateOnTyping: true,
    override: sources,
  });
};

const createEditableExtension = (readOnly: boolean): Extension => [
  EditorState.readOnly.of(readOnly),
  EditorView.editable.of(!readOnly),
];

const SqlEditorInner = (
  {
    ariaLabel,
    completionSchema,
    completionSource,
    defaultSchema,
    defaultTable,
    errorLine,
    onFormat,
    onRun,
    onRunCurrent,
    onSave,
    onSelectionChange,
    onValueChange,
    placeholderText,
    readOnly = false,
    value,
  }: SqlEditorProps,
  ref: Ref<SqlEditorHandle>,
) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onRunRef = useRef(onRun);
  const onRunCurrentRef = useRef(onRunCurrent);
  const onSaveRef = useRef(onSave);
  const onFormatRef = useRef(onFormat);
  const applyingExternalValueRef = useRef(false);
  const initialValueRef = useRef(value);
  const initialConfigRef = useRef({
    ariaLabel,
    completionSchema,
    completionSource,
    defaultSchema,
    defaultTable,
    errorLine,
    placeholderText,
    readOnly,
  });

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onRunCurrentRef.current = onRunCurrent;
  }, [onRunCurrent]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onFormatRef.current = onFormat;
  }, [onFormat]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getSelection: () => {
        const selection = viewRef.current?.state.selection.main;
        return {
          start: selection?.from ?? 0,
          end: selection?.to ?? 0,
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const editorView = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          sqlEditorTheme,
          EditorView.contentAttributes.of({
            'aria-label': initialConfigRef.current.ariaLabel,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applyingExternalValueRef.current) {
              onValueChangeRef.current(update.state.doc.toString());
            }

            if (update.selectionSet || update.docChanged) {
              const selection = update.state.selection.main;
              onSelectionChangeRef.current({
                start: selection.from,
                end: selection.to,
              });
            }
          }),
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          closeBrackets(),
          syntaxHighlighting(sqlHighlightStyle),
          sqlSupportCompartment.of(
            sql({ dialect: SQLite, upperCaseKeywords: true }),
          ),
          autocompleteCompartment.of(
            createAutocompleteExtension({
              completionSchema: initialConfigRef.current.completionSchema,
              completionSource: initialConfigRef.current.completionSource,
              defaultSchema: initialConfigRef.current.defaultSchema,
              defaultTable: initialConfigRef.current.defaultTable,
            }),
          ),
          errorLineCompartment.of(
            createErrorLineExtension(initialConfigRef.current.errorLine),
          ),
          placeholderCompartment.of(
            placeholder(initialConfigRef.current.placeholderText),
          ),
          editableCompartment.of(
            createEditableExtension(initialConfigRef.current.readOnly),
          ),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current();
                return true;
              },
            },
            {
              key: 'Shift-Mod-Enter',
              run: () => {
                onRunCurrentRef.current();
                return true;
              },
            },
            {
              key: 'Mod-s',
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            {
              key: 'Shift-Alt-f',
              run: () => {
                onFormatRef.current();
                return true;
              },
            },
            indentWithTab,
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...defaultKeymap,
          ]),
        ],
      }),
    });

    viewRef.current = editorView;
    onSelectionChangeRef.current({
      start: editorView.state.selection.main.from,
      end: editorView.state.selection.main.to,
    });

    return () => {
      viewRef.current = null;
      editorView.destroy();
    };
  }, []);

  useEffect(() => {
    const editorView = viewRef.current;
    if (!editorView) {
      return;
    }

    editorView.dispatch({
      effects: [
        sqlSupportCompartment.reconfigure(
          sql({ dialect: SQLite, upperCaseKeywords: true }),
        ),
        autocompleteCompartment.reconfigure(
          createAutocompleteExtension({
            completionSchema,
            completionSource,
            defaultSchema,
            defaultTable,
          }),
        ),
        errorLineCompartment.reconfigure(createErrorLineExtension(errorLine)),
        placeholderCompartment.reconfigure(placeholder(placeholderText)),
        editableCompartment.reconfigure(createEditableExtension(readOnly)),
      ],
    });
  }, [
    completionSchema,
    completionSource,
    defaultSchema,
    defaultTable,
    errorLine,
    placeholderText,
    readOnly,
  ]);

  useEffect(() => {
    const editorView = viewRef.current;
    if (!editorView) {
      return;
    }

    const currentValue = editorView.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    const selection = editorView.state.selection.main;
    const nextSelection = EditorSelection.single(
      Math.min(selection.anchor, value.length),
      Math.min(selection.head, value.length),
    );

    applyingExternalValueRef.current = true;
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
      selection: nextSelection,
    });
    applyingExternalValueRef.current = false;
  }, [value]);

  return <div ref={hostRef} className="sqlite-editor-shell" />;
};

export const SqlEditor = forwardRef(SqlEditorInner);
SqlEditor.displayName = 'SqlEditor';
