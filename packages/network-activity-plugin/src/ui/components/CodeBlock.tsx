import { PropsWithChildren } from 'react';

export type CodeBlockProps = PropsWithChildren;

export const CodeBlock = ({ children }: CodeBlockProps) => {
  return (
    <pre
      className={
        'text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto wrap-anywhere'
      }
    >
      {children}
    </pre>
  );
};
