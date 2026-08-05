import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../utils/cn';

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

export type SidebarGroupProps = ComponentProps<'div'> & {
  label?: ReactNode;
};

function SidebarGroup({
  className,
  label,
  children,
  ...props
}: SidebarGroupProps) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn('flex flex-col gap-0.5', className)}
      {...props}
    >
      {label && (
        <div
          data-slot="sidebar-group-label"
          className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60"
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export type SidebarItemProps = ComponentProps<'button'> & {
  selected?: boolean;
  /** Rendered at the end of the row, e.g. a `Badge` with an entry count. */
  trailing?: ReactNode;
};

function SidebarItem({
  className,
  selected = false,
  trailing,
  children,
  type = 'button',
  ...props
}: SidebarItemProps) {
  return (
    <button
      type={type}
      data-slot="sidebar-item"
      data-selected={selected || undefined}
      aria-current={selected || undefined}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        'data-[selected]:bg-sidebar-accent data-[selected]:text-sidebar-accent-foreground data-[selected]:font-medium',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export const Sidebar = Object.assign(SidebarRoot, {
  Group: SidebarGroup,
  Item: SidebarItem,
});
