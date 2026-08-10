import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar';
import { cn } from '../utils/cn';
import { Separator, type SeparatorProps } from '../separator/separator';

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

export type ToolbarButtonProps = ToolbarPrimitive.Button.Props;

function ToolbarButton({ className, ...props }: ToolbarButtonProps) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
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
