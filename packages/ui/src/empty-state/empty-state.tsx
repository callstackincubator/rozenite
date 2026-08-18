import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '../utils/cn';

export type EmptyStateProps = ComponentProps<'div'> & {
  /** A `lucide-react` icon component, rendered above the title. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** e.g. a `Button` to retry or take a corrective action. */
  action?: ReactNode;
  /** Replace the rendered element. */
  render?: useRender.RenderProp;
};

/** A centered message for an empty view with optional guidance and action. */
export function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  render,
  ref,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded so it can't override the composed children below via ...props
  children: _children,
  ...props
}: EmptyStateProps) {
  return useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'empty-state',
      className: cn(
        'flex flex-1 flex-col items-center justify-center gap-1.5 p-8 text-center',
        className,
      ),
      children: (
        <>
          {Icon && <Icon className="mb-2 h-8 w-8 text-muted-foreground" />}
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
          {action && <div className="mt-3">{action}</div>}
        </>
      ),
      ...props,
    },
  });
}
