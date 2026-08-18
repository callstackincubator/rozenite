import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../utils/cn';

export type LinkProps = ComponentProps<'a'> & {
  /** Renders the trailing arrow affordance and opens the link in a new tab
   *  with `rel="noreferrer" target="_blank"`. */
  external?: boolean;
  /** Replace the rendered element, e.g. `render={<RouterLink to="..." />}`. */
  render?: useRender.RenderProp;
};

/** A styled anchor for inline and standalone navigation. Renders an `<a>` by
 *  default; pass `render` to compose with a router's own link component. */
export function Link({ external = false, className, children, render, ref, ...props }: LinkProps) {
  return useRender({
    render: render ?? <a />,
    ref,
    props: {
      'data-slot': 'link',
      rel: external ? 'noreferrer' : undefined,
      target: external ? '_blank' : undefined,
      className: cn(
        'group inline-flex items-center gap-1 text-sm font-medium text-primary outline-none',
        'hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        className,
      ),
      children: (
        <>
          {children}
          {external && (
            <ArrowUpRight
              aria-hidden="true"
              className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          )}
        </>
      ),
      ...props,
    },
  });
}
