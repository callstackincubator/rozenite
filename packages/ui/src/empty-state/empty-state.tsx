import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type EmptyStateProps = ComponentProps<'div'> & {
  /** A `lucide-react` icon component, rendered above the title. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** e.g. a `Button` to retry or take a corrective action. */
  action?: ReactNode;
};

export function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1.5 p-8 text-center',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="mb-2 h-8 w-8 text-muted-foreground" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
