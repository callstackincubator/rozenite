import { HTMLProps, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { cn } from '../utils/cn';

export type CodeBlockProps = HTMLProps<HTMLPreElement>;

// Above this character count, string content renders through Virtuoso
// instead of a flat <pre>. Tuned so typical responses (<20KB) stay on
// the simple path, while pathological payloads (large pretty-printed
// JSON / minified bundles served as text / huge logs) virtualize.
const VIRTUALIZATION_THRESHOLD = 50_000;

const codeBlockClassNames =
  'text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded-md border border-gray-700 overflow-x-auto wrap-anywhere';

export const CodeBlock = ({
  children,
  className,
  ...props
}: CodeBlockProps) => {
  // Only string children are eligible for virtualization. Component
  // children (JsonTree / XmlTree / etc.) manage their own rendering;
  // CodeBlock here just provides the monospace-on-dark frame.
  if (
    typeof children === 'string' &&
    children.length > VIRTUALIZATION_THRESHOLD
  ) {
    return <VirtualizedCodeBlock text={children} className={className} />;
  }

  return (
    <pre className={cn(codeBlockClassNames, className)} {...props}>
      {children}
    </pre>
  );
};

type VirtualizedCodeBlockProps = {
  text: string;
  className?: string;
};

const VirtualizedCodeBlock = ({
  text,
  className,
}: VirtualizedCodeBlockProps) => {
  const lines = useMemo(() => text.split('\n'), [text]);

  // Content with no newlines collapses to a single row containing the
  // entire payload. Browser wrapping (whitespace-pre-wrap, wrap-anywhere)
  // still keeps layout sane, but there's no real virtualization benefit
  // for that shape — the size win shows up once the body has many lines.
  return (
    <Virtuoso
      style={{ height: 500 }}
      totalCount={lines.length}
      itemContent={(idx) => (
        <div className="whitespace-pre-wrap wrap-anywhere">{lines[idx]}</div>
      )}
      className={cn(codeBlockClassNames, className)}
    />
  );
};
