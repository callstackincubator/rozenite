import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';
import { monoLabel } from '../utils/mono-label';

const toggleGroupSize = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
} as const satisfies Record<Size, string>;

const toggleGroupItemSize = {
  sm: 'px-2.5 text-[11px] [&_svg]:size-3.5',
  md: 'px-3 text-[11px] [&_svg]:size-4',
  lg: 'px-4 text-xs [&_svg]:size-5',
} as const satisfies Record<Size, string>;

export type ToggleGroupProps<Value extends string = string> = ToggleGroupPrimitive.Props<Value> & {
  /** @default 'md' */
  size?: Size;
};

function ToggleGroupRoot<Value extends string = string>({
  className,
  size = 'md',
  ...props
}: ToggleGroupProps<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        'inline-flex items-stretch rounded-md border border-border text-faint',
        toggleGroupSize[size],
        className,
      )}
      {...props}
    />
  );
}

export type ToggleGroupItemProps<Value extends string = string> = TogglePrimitive.Props<Value> & {
  /** @default 'md' */
  size?: Size;
};

function ToggleGroupItem<Value extends string = string>({
  className,
  size = 'md',
  ...props
}: ToggleGroupItemProps<Value>) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-faint transition-colors duration-[120ms] not-first:border-l not-first:border-border',
        monoLabel,
        'hover:text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        'data-[pressed]:bg-accent data-[pressed]:text-foreground data-[pressed]:shadow-[inset_0_-2px_0_var(--primary)]',
        'disabled:pointer-events-none disabled:opacity-50',
        toggleGroupItemSize[size],
        className,
      )}
      {...props}
    />
  );
}

/** A segmented control for one or more independent on/off facets. */
export const ToggleGroup = Object.assign(ToggleGroupRoot, { Item: ToggleGroupItem });
