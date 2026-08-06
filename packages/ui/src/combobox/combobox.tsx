import type { ReactNode } from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';

export type ComboboxProps<
  Value,
  Multiple extends boolean | undefined = false,
> = ComboboxPrimitive.Root.Props<Value, Multiple>;

function ComboboxRoot<Value, Multiple extends boolean | undefined = false>(
  props: ComboboxProps<Value, Multiple>,
) {
  return <ComboboxPrimitive.Root {...props} />;
}

export type ComboboxInputProps = ComboboxPrimitive.Input.Props;

function ComboboxInput({ className, ...props }: ComboboxInputProps) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className="relative flex items-center"
    >
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          'h-8 w-full rounded-md border border-input bg-transparent px-3 pr-14 text-sm text-foreground shadow-xs',
          'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          'placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <div className="absolute right-1.5 flex items-center gap-0.5">
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </ComboboxPrimitive.Clear>
        <ComboboxPrimitive.Icon data-slot="combobox-icon">
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </ComboboxPrimitive.Icon>
      </div>
    </ComboboxPrimitive.InputGroup>
  );
}

export type ComboboxContentProps = ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align'> & {
    /** Shown when the list has no matching items. */
    emptyMessage?: ReactNode;
  };

function ComboboxContent({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  emptyMessage = 'No results found.',
  children,
  ...props
}: ComboboxContentProps) {
  const container = usePluginPortalContainer();

  return (
    <ComboboxPrimitive.Portal container={container}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            'max-h-64 min-w-[--anchor-width] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
            'origin-(--transform-origin) transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        >
          <ComboboxPrimitive.Empty
            data-slot="combobox-empty"
            className="px-2 py-1.5 text-sm text-muted-foreground"
          >
            {emptyMessage}
          </ComboboxPrimitive.Empty>
          <ComboboxPrimitive.List>{children}</ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export type ComboboxItemProps = ComboboxPrimitive.Item.Props;

function ComboboxItem({ className, children, ...props }: ComboboxItemProps) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        'flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground select-none',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/** A searchable input for selecting one or more values from a list. */
export const Combobox = Object.assign(ComboboxRoot, {
  Input: ComboboxInput,
  Content: ComboboxContent,
  Item: ComboboxItem,
});
