import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';

export type MenuProps = MenuPrimitive.Root.Props;

function MenuRoot(props: MenuProps) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />;
}

export type MenuTriggerProps = MenuPrimitive.Trigger.Props;

function MenuTrigger(props: MenuTriggerProps) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

export type MenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>;

function MenuContent({
  className,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  alignOffset = 0,
  children,
  ...props
}: MenuContentProps) {
  const container = usePluginPortalContainer();

  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="z-50"
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            'max-h-(--available-height) min-w-40 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
            'origin-(--transform-origin) transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export type MenuItemProps = MenuPrimitive.Item.Props;

function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground select-none',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export type MenuCheckboxItemProps = MenuPrimitive.CheckboxItem.Props;

function MenuCheckboxItem({ className, children, ...props }: MenuCheckboxItemProps) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cn(
        'flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground select-none',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <MenuPrimitive.CheckboxItemIndicator>
        <Check className="size-3.5" />
      </MenuPrimitive.CheckboxItemIndicator>
    </MenuPrimitive.CheckboxItem>
  );
}

export type MenuSeparatorProps = MenuPrimitive.Separator.Props;

function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export type MenuGroupProps = MenuPrimitive.Group.Props;

function MenuGroup(props: MenuGroupProps) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export type MenuGroupLabelProps = MenuPrimitive.GroupLabel.Props;

function MenuGroupLabel({ className, ...props }: MenuGroupLabelProps) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-group-label"
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

/** A dropdown menu of actions, opened from a trigger. */
export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  Separator: MenuSeparator,
  Group: MenuGroup,
  GroupLabel: MenuGroupLabel,
});
