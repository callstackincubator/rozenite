import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import { Tooltip } from '../tooltip/tooltip';
import type { Size } from '../tokens/size';
import { surfaceTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

const iconButtonSize = {
  sm: 'size-6 p-0 [&_svg]:size-3.5',
  md: 'size-8 p-0 [&_svg]:size-4',
  lg: 'size-10 p-0 [&_svg]:size-5',
} as const satisfies Record<Size, string>;

export type IconButtonProps = ComponentProps<'button'> &
  Pick<VariantProps<typeof surfaceTone>, 'variant'> & {
    /** @default 'primary' */
    tone?: Tone;
    /** @default 'md' */
    size?: Size;
    /** Accessible name, also shown as the button's tooltip. An unlabelled icon button is a type error. */
    label: string;
    /** Replace the rendered element, e.g. `render={<a href="..." />}`. */
    render?: useRender.RenderProp;
  };

/** A square, icon-only button. Always labelled — `label` doubles as the
 *  accessible name and the tooltip text. */
export function IconButton({
  className,
  tone = 'primary',
  variant,
  size = 'md',
  label,
  type = 'button',
  children,
  render,
  ref,
  ...props
}: IconButtonProps) {
  const element = useRender({
    render: render ?? <button type={type} />,
    ref,
    props: {
      'aria-label': label,
      'data-slot': 'icon-button',
      className: cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        surfaceTone({ tone, variant }),
        iconButtonSize[size],
        className,
      ),
      children,
      ...props,
    },
  });

  return (
    <Tooltip>
      <Tooltip.Trigger render={element} />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
