import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type ListProps = ComponentProps<'div'>;

function ListRoot({ className, ...props }: ListProps) {
  return <div data-slot="list" className={cn('flex flex-col gap-4', className)} {...props} />;
}

export type ListGroupProps = ComponentProps<'div'> & {
  label?: ReactNode;
};

function ListGroup({ className, label, children, ...props }: ListGroupProps) {
  return (
    <div data-slot="list-group" className={cn('flex flex-col gap-0.5', className)} {...props}>
      {label && (
        <div
          data-slot="list-group-label"
          className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60"
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export type ListItemProps = ComponentProps<'button'> & {
  selected?: boolean;
  /** Rendered at the start of the row, before the label. Typically an icon. */
  adornment?: ReactNode;
  /** Rendered at the end of the row, e.g. a `Badge` with an entry count. */
  trailing?: ReactNode;
};

function ListItem({
  className,
  selected = false,
  adornment,
  trailing,
  children,
  type = 'button',
  ...props
}: ListItemProps) {
  return (
    <button
      type={type}
      data-slot="list-item"
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
      {adornment && (
        <span
          data-slot="list-item-adornment"
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5"
        >
          {adornment}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

/** A list of grouped, selectable items with optional leading and trailing content. */
export const List = Object.assign(ListRoot, {
  Group: ListGroup,
  Item: ListItem,
});
