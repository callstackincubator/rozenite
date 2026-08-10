import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type DescriptionListProps = ComponentProps<'div'>;

function DescriptionListRoot({ className, ...props }: DescriptionListProps) {
  return (
    <div
      data-slot="description-list"
      className={cn(
        'grid grid-cols-[minmax(7rem,25%)_minmax(3rem,1fr)] gap-x-2 gap-y-2 text-sm',
        className,
      )}
      {...props}
    />
  );
}

export type DescriptionListItemProps = ComponentProps<'div'> & {
  label: ReactNode;
};

function DescriptionListItem({ label, className, children, ...props }: DescriptionListItemProps) {
  return (
    <div data-slot="description-list-item" className={cn('contents', className)} {...props}>
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** A list of label/value rows, e.g. metadata about an entity. */
export const DescriptionList = Object.assign(DescriptionListRoot, {
  Item: DescriptionListItem,
});
