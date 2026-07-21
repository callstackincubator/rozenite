import { forwardRef } from 'react';

export type CodeEditorProps = {
  data: string | undefined;
  onInput?: (event: React.FormEvent<HTMLPreElement>) => void;
};

export const CodeEditor = forwardRef<HTMLPreElement, CodeEditorProps>(
  ({ data, onInput }, ref) => {
    return (
      <pre
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={
          'w-full text-sm font-mono text-foreground/70 whitespace-pre-wrap bg-surface p-3 rounded-md border border-border/60 overflow-x-auto wrap-anywhere ring-offset-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
        }
        onInput={onInput}
      >
        {data}
      </pre>
    );
  }
);

CodeEditor.displayName = 'CodeEditor';
