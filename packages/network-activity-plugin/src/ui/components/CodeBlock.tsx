import { HTMLProps } from 'react';
import { cn } from '../utils/cn';

export type CodeBlockProps = HTMLProps<HTMLPreElement>;

const codeBlockClassNames =
  'text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded border border-gray-700 overflow-x-auto wrap-anywhere';

export const CodeBlock = ({
  children,
  className,
  ...props
}: CodeBlockProps) => {
  return (
    <pre className={cn(codeBlockClassNames, className)} {...props}>
      {children}
    </pre>
  );
};
