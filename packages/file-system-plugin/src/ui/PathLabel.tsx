import { cn } from '@rozenite/ui';

type PathLabelProps = {
  path: string;
  className?: string;
};

/**
 * A single-line filesystem path that truncates from the *left*. Paths share
 * long prefixes and differ at the end, so clipping the head keeps the part
 * that identifies the file readable.
 *
 * `dir="rtl"` puts the line's overflow — and with it the ellipsis — at the
 * start; the inner `<bdi>` isolates the path so its own characters still lay
 * out left-to-right instead of being reordered by the surrounding direction.
 */
export function PathLabel({ path, className }: PathLabelProps) {
  return (
    <span
      dir="rtl"
      title={path}
      className={cn(
        'min-w-0 flex-1 truncate px-1 text-left font-mono text-xs text-muted-foreground',
        className,
      )}
    >
      <bdi>{path}</bdi>
    </span>
  );
}
