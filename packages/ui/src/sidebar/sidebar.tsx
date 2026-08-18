import type { ComponentProps, ReactNode } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';

const sidebarItemSize = {
  sm: 'h-6 text-xs',
  md: 'h-8 text-sm',
  lg: 'h-10 text-base',
} as const satisfies Record<Size, string>;

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

function SidebarGroup({ className, label, children, ...props }: SidebarGroupProps) {
  return (
    <div data-slot="sidebar-group" className={cn('flex flex-col gap-0.5', className)} {...props}>
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
  /** Rendered at the start of the row, before the label. Typically an icon. */
  leading?: ReactNode;
  /** Rendered at the end of the row, e.g. a `Badge` with an entry count. */
  trailing?: ReactNode;
  /** @default 'sm' */
  size?: Size;
  /** Replace the rendered element, e.g. `render={<a href="..." />}` for a navigable item. */
  render?: useRender.RenderProp;
};

function SidebarItem({
  className,
  selected = false,
  leading,
  trailing,
  size = 'sm',
  children,
  type = 'button',
  render,
  ref,
  ...props
}: SidebarItemProps) {
  return useRender({
    render: render ?? <button type={type} />,
    ref,
    props: {
      'data-slot': 'sidebar-item',
      'data-selected': selected || undefined,
      'aria-current': selected || undefined,
      className: cn(
        'flex w-full items-center gap-2 rounded-md px-2 text-left text-sidebar-foreground',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        'data-[selected]:bg-sidebar-accent data-[selected]:text-sidebar-accent-foreground data-[selected]:font-medium',
        sidebarItemSize[size],
        className,
      ),
      children: (
        <>
          {leading && (
            <span
              data-slot="sidebar-item-leading"
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5"
            >
              {leading}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{children}</span>
          {trailing}
        </>
      ),
      ...props,
    },
  });
}

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
  Group: SidebarGroup,
  Item: SidebarItem,
  Header: SidebarHeader,
  Footer: SidebarFooter,
});
