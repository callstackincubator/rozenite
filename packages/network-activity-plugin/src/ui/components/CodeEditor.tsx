import { forwardRef } from 'react';

export type CodeEditorProps = {
  data: string | undefined;
  onInput?: (event: React.FormEvent<HTMLPreElement>) => void;
};

export const CodeEditor = forwardRef<HTMLPreElement, CodeEditorProps>(({ data, onInput }, ref) => {
  return (
    <pre
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={
        'w-full overflow-x-auto border border-input bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-foreground wrap-anywhere transition-colors duration-[120ms] outline-none hover:border-faint focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring'
      }
      onInput={onInput}
    >
      {data}
    </pre>
  );
});

CodeEditor.displayName = 'CodeEditor';
