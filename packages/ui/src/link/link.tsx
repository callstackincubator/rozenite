import type { ComponentProps } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../utils/cn';

export type LinkProps = ComponentProps<'a'> & {
  /** Renders the trailing arrow affordance and opens the link in a new tab
   *  with `rel="noreferrer" target="_blank"`. */
  external?: boolean;
};

/** A styled anchor for inline and standalone navigation. */
export function Link({ external = false, className, children, ...props }: LinkProps) {
  return (
    <a
      data-slot="link"
      rel={external ? 'noreferrer' : undefined}
      target={external ? '_blank' : undefined}
      className={cn(
        'group inline-flex items-center gap-1 text-sm font-medium text-primary outline-none',
        'hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      {children}
      {external && (
        <ArrowUpRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      )}
    </a>
  );
}
