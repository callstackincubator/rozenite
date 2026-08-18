import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar';
import { cn } from '../utils/cn';
import { Separator, type SeparatorProps } from '../separator/separator';
import type { Size } from '../tokens/size';

const toolbarButtonSize = {
  sm: 'h-6 px-2 text-xs [&_svg]:size-3.5',
  md: 'h-8 px-3 text-sm [&_svg]:size-4',
  lg: 'h-10 px-4 text-base [&_svg]:size-5',
} as const satisfies Record<Size, string>;

export type ToolbarProps = ToolbarPrimitive.Root.Props;

function ToolbarRoot({ className, ...props }: ToolbarProps) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={cn(
        'flex items-center gap-1 border-b border-border bg-card px-2 py-1.5',
        className,
      )}
      {...props}
    />
  );
}

export type ToolbarButtonProps = ToolbarPrimitive.Button.Props & {
  /** @default 'sm' */
  size?: Size;
};

function ToolbarButton({ className, size = 'sm', ...props }: ToolbarButtonProps) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'aria-disabled:pointer-events-none aria-disabled:opacity-50',
        toolbarButtonSize[size],
        className,
      )}
      {...props}
    />
  );
}

export type ToolbarSeparatorProps = SeparatorProps;

/** An alias for `Separator`, styled for use inside a `Toolbar`. */
function ToolbarSeparator({
  orientation = 'vertical',
  className,
  ...props
}: ToolbarSeparatorProps) {
  return (
    <Separator
      data-slot="toolbar-separator"
      orientation={orientation}
      className={cn('mx-1', className)}
      {...props}
    />
  );
}

export type ToolbarGroupProps = ToolbarPrimitive.Group.Props;

function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={cn('flex items-center gap-1', className)}
      {...props}
    />
  );
}

/** A compact action bar for related controls and separators. */
export const Toolbar = Object.assign(ToolbarRoot, {
  Button: ToolbarButton,
  Separator: ToolbarSeparator,
  Group: ToolbarGroup,
});
