import type { CSSProperties, ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import { cn } from '../utils/cn';

export type SplitDirection = 'horizontal' | 'vertical';

export type SplitProps = {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Disables resizing for every pane in this group. */
  disabled?: boolean;
  /** Layout axis of the group. */
  direction?: SplitDirection;
  /**
   * Stable id used to key persisted layouts in a future release. Accepted
   * today for API stability, but layout persistence is not wired up yet.
   */
  autoSaveId?: string;
};

function SplitRoot({
  direction = 'horizontal',
  autoSaveId,
  id,
  className,
  ...props
}: SplitProps) {
  return (
    <Group
      data-slot="split"
      orientation={direction}
      // Layout persistence isn't wired up yet — `autoSaveId` only labels the
      // group for now, falling back to it as a stable `id` when one isn't
      // given explicitly.
      id={id ?? autoSaveId}
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  );
}

export type SplitPaneProps = {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Numbers are percentages; strings are passed through, so an explicit
   * unit (e.g. "200px", "22%") can still be used. */
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  /** Whether the pane can be collapsed down to `collapsedSize`. */
  collapsible?: boolean;
  collapsedSize?: number | string;
};

// react-resizable-panels v4 treats a bare number as pixels and a unitless
// string as a percentage. Split.Pane's contract is the opposite — a bare
// number means percent, which is the intuitive reading — so numbers are
// converted to percentage strings before being handed to `Panel`. Strings
// pass through untouched, letting an author opt into explicit units.
export function toPanelSize(
  size: number | string | undefined,
): number | string | undefined {
  return typeof size === 'number' ? `${size}%` : size;
}

function SplitPane({
  className,
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  ...props
}: SplitPaneProps) {
  return (
    <Panel
      data-slot="split-pane"
      className={cn('min-h-0 min-w-0', className)}
      defaultSize={toPanelSize(defaultSize)}
      minSize={toPanelSize(minSize)}
      maxSize={toPanelSize(maxSize)}
      collapsedSize={toPanelSize(collapsedSize)}
      {...props}
    />
  );
}

export type SplitHandleProps = {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  disabled?: boolean;
  /** Renders a grip affordance in the middle of the handle. */
  withHandle?: boolean;
};

function SplitHandle({
  className,
  withHandle = true,
  children,
  ...props
}: SplitHandleProps) {
  return (
    <Separator
      data-slot="split-handle"
      className={cn(
        // A horizontal Split renders a vertical (left/right) separator, and
        // vice versa — aria-orientation reflects the separator's own axis.
        'group/split-handle relative flex aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px',
        'items-center justify-center bg-border',
        'hover:bg-ring/50 data-[active]:bg-ring',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'transition-colors',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            'z-10 flex items-center justify-center rounded-sm border border-border bg-border',
            // `aria-orientation` lives on the Separator, so these read it from
            // the parent rather than from the grip itself.
            'group-aria-[orientation=vertical]/split-handle:h-4 group-aria-[orientation=vertical]/split-handle:w-3',
            'group-aria-[orientation=horizontal]/split-handle:h-3 group-aria-[orientation=horizontal]/split-handle:w-4 group-aria-[orientation=horizontal]/split-handle:rotate-90',
          )}
        >
          <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}
      {children}
    </Separator>
  );
}

export const Split = Object.assign(SplitRoot, {
  Pane: SplitPane,
  Handle: SplitHandle,
});
