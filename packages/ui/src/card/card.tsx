import { createContext, useContext, useState, type ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils/cn';

type CardContextValue = {
  collapsible: boolean;
  open: boolean;
  toggle: () => void;
  collapseLabel: string;
  expandLabel: string;
};

const CardContext = createContext<CardContextValue | null>(null);

export type CardProps = ComponentProps<'div'> & {
  /** Whether `Card.Body` can be collapsed via a toggle in `Card.Header`. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Accessible name for the collapse toggle when open.
   * @default 'Collapse' */
  collapseLabel?: string;
  /** Accessible name for the collapse toggle when closed.
   * @default 'Expand' */
  expandLabel?: string;
  /** Replace the rendered element, e.g. `render={<section />}`. */
  render?: useRender.RenderProp;
};

function CardRoot({
  collapsible = false,
  defaultOpen = true,
  collapseLabel = 'Collapse',
  expandLabel = 'Expand',
  className,
  render,
  ref,
  ...props
}: CardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <CardContext.Provider
      value={{
        collapsible,
        open,
        toggle: () => setOpen((current) => !current),
        collapseLabel,
        expandLabel,
      }}
    >
      {useRender({
        render: render ?? <div />,
        ref,
        props: {
          'data-slot': 'card',
          className: cn('rounded-lg border border-border bg-card text-card-foreground', className),
          ...props,
        },
      })}
    </CardContext.Provider>
  );
}

export type CardHeaderProps = ComponentProps<'div'>;

function CardHeader({ className, children, ...props }: CardHeaderProps) {
  const context = useContext(CardContext);

  return (
    <div
      data-slot="card-header"
      className={cn('flex items-center gap-2 p-3', className)}
      {...props}
    >
      {context?.collapsible && (
        <button
          type="button"
          data-slot="card-collapse-toggle"
          aria-expanded={context.open}
          aria-label={context.open ? context.collapseLabel : context.expandLabel}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded outline-none',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={context.toggle}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 transition-transform', context.open && 'rotate-90')}
          />
        </button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

export type CardBodyProps = ComponentProps<'div'>;

function CardBody({ className, ...props }: CardBodyProps) {
  const context = useContext(CardContext);

  if (context?.collapsible && !context.open) {
    return null;
  }

  return (
    <div data-slot="card-body" className={cn('border-t border-border p-3', className)} {...props} />
  );
}

/** A bordered container for grouping related content, optionally collapsible. */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
});
