import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';
import {
  classifyValue,
  getChildKeys,
  getContainerSummary,
  isExpandable,
  type JsonNodeType,
} from './json-node';

export type JsonInspectorProps = {
  data: unknown;
  className?: string;
  /** Root nesting depths expanded by default. @default 1 */
  defaultExpandedDepth?: number;
};

/** A collapsible tree for inspecting structured JSON-like values. */
export function JsonInspector({
  data,
  className,
  defaultExpandedDepth = 1,
}: JsonInspectorProps) {
  return (
    <div
      data-slot="json-inspector"
      className={cn('font-mono text-xs', className)}
    >
      <JsonNodeView
        label={null}
        value={data}
        depth={0}
        defaultExpandedDepth={defaultExpandedDepth}
      />
    </div>
  );
}

type JsonNodeViewProps = {
  label: string | null;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
};

function JsonNodeView({
  label,
  value,
  depth,
  defaultExpandedDepth,
}: JsonNodeViewProps) {
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);
  const expandable = isExpandable(value);

  if (!expandable) {
    return (
      <div data-slot="json-inspector-leaf" className="flex gap-1">
        {label !== null && (
          <span className="text-muted-foreground">{label}:</span>
        )}
        <LeafValue value={value} />
      </div>
    );
  }

  const childKeys = getChildKeys(value) ?? [];

  return (
    <div data-slot="json-inspector-node">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1 text-foreground hover:text-primary"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
        />
        {label !== null && (
          <span className="text-muted-foreground">{label}:</span>
        )}
        <span className="text-muted-foreground">
          {getContainerSummary(value)}
        </span>
      </button>
      {expanded && (
        <div className="ml-3.5 border-l border-border pl-2">
          {childKeys.map((key) => (
            <JsonNodeView
              key={key}
              label={key}
              value={(value as Record<string, unknown>)[key]}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const LEAF_COLOR_BY_TYPE: Partial<Record<JsonNodeType, string>> = {
  string: 'text-primary',
  number: 'text-accent-foreground',
  boolean: 'text-secondary-foreground',
  null: 'text-destructive',
  undefined: 'text-destructive',
};

function LeafValue({ value }: { value: unknown }) {
  const type = classifyValue(value);
  const text = type === 'string' ? `"${value as string}"` : String(value);

  return (
    <span className={LEAF_COLOR_BY_TYPE[type] ?? 'text-foreground'}>
      {text}
    </span>
  );
}
