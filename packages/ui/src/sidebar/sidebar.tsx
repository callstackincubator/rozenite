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

export type SidebarHeaderProps = ComponentProps<'header'>;

function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <header
      data-slot="sidebar-header"
      className={cn(
        'sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-sidebar-border bg-sidebar px-3',
        className,
      )}
      {...props}
    />
  );
}

export type SidebarFooterProps = ComponentProps<'footer'>;

function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <footer
      data-slot="sidebar-footer"
      className={cn('mt-auto flex shrink-0 gap-1 border-t border-sidebar-border p-2', className)}
      {...props}
    />
  );
}

/** A navigation rail with grouped, selectable items and optional trailing content. */
export const Sidebar = Object.assign(SidebarRoot, {
  Group: List.Group,
  Item: List.Item,
  Header: SidebarHeader,
  Footer: SidebarFooter,
});
