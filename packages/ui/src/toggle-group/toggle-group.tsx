import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';

const toggleGroupSize = {
  sm: 'h-6 p-0.5',
  md: 'h-8 p-1',
  lg: 'h-10 p-1',
} as const satisfies Record<Size, string>;

const toggleGroupItemSize = {
  sm: 'h-5 px-2 text-xs [&_svg]:size-3.5',
  md: 'h-6 px-2.5 text-sm [&_svg]:size-4',
  lg: 'h-8 px-3 text-base [&_svg]:size-5',
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
        'inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground',
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
        'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap text-muted-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-xs',
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
