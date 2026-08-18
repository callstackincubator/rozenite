import type { ReactNode } from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';
import { fieldSurface, optionRow, popoverSurface } from '../utils/control-surfaces';
import type { Size } from '../tokens/size';

export type ComboboxProps<
  Value,
  Multiple extends boolean | undefined = false,
> = ComboboxPrimitive.Root.Props<Value, Multiple>;

function ComboboxRoot<Value, Multiple extends boolean | undefined = false>(
  props: ComboboxProps<Value, Multiple>,
) {
  return <ComboboxPrimitive.Root {...props} />;
}

const comboboxInputSize = {
  sm: { pad: 'pr-11', cluster: 'right-1', control: 'size-4', icon: 'size-3' },
  md: { pad: 'pr-14', cluster: 'right-1.5', control: 'size-5', icon: 'size-3.5' },
  lg: { pad: 'pr-16', cluster: 'right-2', control: 'size-6', icon: 'size-4' },
} as const satisfies Record<Size, unknown>;

export type ComboboxInputProps = Omit<ComboboxPrimitive.Input.Props, 'size'> & {
  /** @default 'md' */
  size?: Size;
};

function ComboboxInput({ className, size = 'md', ...props }: ComboboxInputProps) {
  const sizing = comboboxInputSize[size];

  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className="relative flex items-center"
    >
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(fieldSurface({ size }), sizing.pad, className)}
        {...props}
      />
      <div className={cn('absolute flex items-center gap-0.5', sizing.cluster)}>
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          className={cn(
            'inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground',
            sizing.control,
          )}
        >
          <X className={sizing.icon} />
        </ComboboxPrimitive.Clear>
        <ComboboxPrimitive.Icon data-slot="combobox-icon">
          <ChevronsUpDown className={cn('text-muted-foreground', sizing.icon)} />
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
          className={cn(popoverSurface(), className)}
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
      className={cn(optionRow(), className)}
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
