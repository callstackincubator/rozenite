import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionSource,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { schemaCompletionSource, sql, SQLite, type SQLNamespace } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
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
import { usePluginTheme } from '@rozenite/ui';
import { forwardRef, useEffect, useImperativeHandle, useRef, type Ref } from 'react';

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
const themeCompartment = new Compartment();

const emptyDecorations = Decoration.set([]);

/*
 * The editor takes its colours from the @rozenite/ui tokens, so it follows the theme without a
 * palette of its own. Code reads as on rozenite.dev (docs/DESIGN.md, "Code"): keywords and
 * punctuation dimmed, names and functions in the foreground, strings and numbers in the
 * accent, comments faint.
 */
const sqlHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword],
    color: 'var(--muted-foreground)',
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: 'var(--primary)',
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.bool],
    color: 'var(--primary)',
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--faint)',
  },
  {
    tag: [tags.name, tags.variableName, tags.propertyName],
    color: 'var(--foreground)',
  },
  {
    tag: [tags.definition(tags.name), tags.typeName, tags.namespace],
    color: 'var(--foreground)',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--foreground)',
  },
  {
    tag: [tags.operator, tags.compareOperator, tags.logicOperator],
    color: 'var(--muted-foreground)',
  },
  {
    tag: tags.null,
    color: 'var(--muted-foreground)',
  },
  {
    tag: [tags.paren, tags.squareBracket, tags.brace, tags.punctuation],
    color: 'var(--muted-foreground)',
  },
]);

const createSqlEditorTheme = (dark: boolean): Extension =>
  EditorView.theme(
    {
      '&': {
        display: 'flex',
        flex: '1 1 auto',
        minHeight: '0',
        height: '100%',
        color: 'var(--foreground)',
        backgroundColor: 'transparent',
        fontSize: '12px',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        display: 'flex',
        flex: '1 1 auto',
        minHeight: '0',
        fontFamily: 'inherit',
        lineHeight: '1.65',
      },
      '.cm-sizer': {
        minHeight: '100%',
        minWidth: '100%',
        flex: '1 1 auto',
      },
      '.cm-content': {
        minHeight: '100%',
        caretColor: 'var(--foreground)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--foreground)',
      },
      '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, ::selection':
        {
          backgroundColor: 'color-mix(in srgb, var(--primary) 25%, transparent)',
        },
      '.cm-placeholder': {
        color: 'var(--faint)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--accent)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--accent)',
        color: 'var(--foreground)',
      },
      '.cm-gutters': {
        color: 'var(--faint)',
        backgroundColor: 'transparent',
        border: 'none',
        borderRight: '1px solid var(--border)',
      },
      '.cm-sqlite-errorLine': {
        backgroundColor: 'color-mix(in srgb, var(--danger) 14%, transparent)',
        boxShadow: 'inset 2px 0 0 var(--danger)',
      },
      '.cm-tooltip': {
        border: '1px solid var(--border-strong)',
        backgroundColor: 'var(--popover)',
        color: 'var(--popover-foreground)',
        borderRadius: '0',
        overflow: 'hidden',
      },
      '.cm-tooltip-autocomplete > ul > li': {
        padding: '2px 8px',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--accent)',
        color: 'var(--foreground)',
      },
      '.cm-completionMatchedText': {
        textDecoration: 'none',
        color: 'var(--primary)',
      },
      '.cm-completionDetail': {
        color: 'var(--faint)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--card)',
        color: 'var(--foreground)',
        borderBottom: '1px solid var(--border)',
      },
      '.cm-panels input, .cm-panels button': {
        fontFamily: 'inherit',
        fontSize: '12px',
      },
      '.cm-panels .cm-textfield': {
        backgroundColor: 'var(--muted)',
        border: '1px solid var(--input)',
        color: 'var(--foreground)',
        borderRadius: '0',
      },
      '.cm-panels .cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'var(--secondary)',
        border: '1px solid var(--border-strong)',
        color: 'var(--foreground)',
        borderRadius: '0',
      },
      '.cm-searchMatch': {
        backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)',
        outline: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'color-mix(in srgb, var(--primary) 26%, transparent)',
      },
      '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: 'var(--accent)',
        outline: '1px solid var(--border-strong)',
      },
    },
    { dark },
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
  const { theme } = usePluginTheme();
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
  const initialThemeRef = useRef(theme);
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
          themeCompartment.of(createSqlEditorTheme(initialThemeRef.current === 'dark')),
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
          sqlSupportCompartment.of(sql({ dialect: SQLite, upperCaseKeywords: true })),
          autocompleteCompartment.of(
            createAutocompleteExtension({
              completionSchema: initialConfigRef.current.completionSchema,
              completionSource: initialConfigRef.current.completionSource,
              defaultSchema: initialConfigRef.current.defaultSchema,
              defaultTable: initialConfigRef.current.defaultTable,
            }),
          ),
          errorLineCompartment.of(createErrorLineExtension(initialConfigRef.current.errorLine)),
          placeholderCompartment.of(placeholder(initialConfigRef.current.placeholderText)),
          editableCompartment.of(createEditableExtension(initialConfigRef.current.readOnly)),
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
        sqlSupportCompartment.reconfigure(sql({ dialect: SQLite, upperCaseKeywords: true })),
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
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(createSqlEditorTheme(theme === 'dark')),
    });
  }, [theme]);

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

  return <div ref={hostRef} className="flex h-full min-h-0 flex-1 flex-col font-mono" />;
};

export const SqlEditor = forwardRef(SqlEditorInner);
SqlEditor.displayName = 'SqlEditor';
