import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { List, type ListGroupProps, type ListItemProps } from '../list/list';

export type SidebarProps = ComponentProps<'nav'>;

function SidebarRoot({ className, ...props }: SidebarProps) {
  return (
    <nav
      data-slot="sidebar"
      className={cn(
        'flex h-full w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground',
        className,
      )}
      {...props}
    />
  );
}

export type SidebarGroupProps = ListGroupProps;
export type SidebarItemProps = ListItemProps;

/** A navigation rail with grouped, selectable items and optional trailing content. */
export const Sidebar = Object.assign(SidebarRoot, {
  Group: List.Group,
  Item: List.Item,
});
