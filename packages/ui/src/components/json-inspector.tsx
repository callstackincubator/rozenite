import { useMemo } from 'react';
import { Button } from '@heroui/react';
import { Check, Copy } from 'lucide-react';
import { JSONTree, type ShouldExpandNodeInitially } from 'react-json-tree';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { cn } from '../utils/cn';

export type JsonInspectorProps = {
  className?: string;
  collectionLimit?: number;
  copyable?: boolean;
  data: unknown;
  hideRoot?: boolean;
  shouldExpandNodeInitially?: ShouldExpandNodeInitially;
  sortObjectKeys?: boolean | ((a: unknown, b: unknown) => number);
};

const jsonTreeTheme = {
  base00: 'transparent',
  base01: 'var(--surface-secondary)',
  base02: 'var(--surface-tertiary)',
  base03: 'var(--muted)',
  base04: 'var(--muted)',
  base05: 'var(--foreground)',
  base06: 'var(--foreground)',
  base07: 'var(--foreground)',
  base08: 'var(--danger)',
  base09: 'var(--warning)',
  base0A: 'var(--success)',
  base0B: 'var(--accent)',
  base0C: 'var(--info)',
  base0D: 'var(--accent)',
  base0E: 'var(--warning)',
  base0F: 'var(--danger)',
};

const stringifyForClipboard = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

export const JsonInspector = ({
  className,
  collectionLimit,
  copyable = false,
  data,
  hideRoot,
  shouldExpandNodeInitially,
  sortObjectKeys,
}: JsonInspectorProps) => {
  const { copy, isCopied } = useCopyToClipboard();
  const clipboardValue = useMemo(() => stringifyForClipboard(data), [data]);

  return (
    <div className={cn('relative text-sm', className)}>
      {copyable ? (
        <Button
          aria-label={isCopied ? 'Copied JSON' : 'Copy JSON'}
          className="absolute top-0 right-0 z-10"
          isIconOnly
          onPress={() => {
            void copy(clipboardValue).catch(() => {});
          }}
          size="sm"
          variant="ghost"
        >
          {isCopied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4 text-muted" />
          )}
        </Button>
      ) : null}
      <div>
        <JSONTree
          collectionLimit={collectionLimit}
          data={data}
          hideRoot={hideRoot}
          invertTheme={false}
          shouldExpandNodeInitially={shouldExpandNodeInitially}
          sortObjectKeys={sortObjectKeys}
          theme={jsonTreeTheme}
        />
      </div>
    </div>
  );
};
