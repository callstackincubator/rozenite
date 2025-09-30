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
          'w-full text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded-md border border-gray-700 overflow-x-auto wrap-anywhere ring-offset-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        }
        onInput={onInput}
      >
        {data}
      </pre>
    );
  }
);

CodeEditor.displayName = 'CodeEditor';
