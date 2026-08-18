import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '../button/button';
import { cn } from '../utils/cn';
import { Tooltip } from '../tooltip/tooltip';
import type { Size } from '../tokens/size';

const iconButtonSize = {
  sm: 'size-6 [&_svg]:size-3.5',
  md: 'size-8 [&_svg]:size-4',
  lg: 'size-10 [&_svg]:size-5',
} as const satisfies Record<Size, string>;

export type IconButtonProps = ComponentProps<'button'> &
  Pick<VariantProps<typeof buttonVariants>, 'variant'> & {
    /** @default 'md' */
    size?: Size;
    /** Accessible name, also shown as the button's tooltip. An unlabelled icon button is a type error. */
    label: string;
  };

/** A square, icon-only button. Always labelled — `label` doubles as the
 *  accessible name and the tooltip text. */
export function IconButton({
  className,
  variant,
  size = 'md',
  label,
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <button
            type={type}
            aria-label={label}
            data-slot="icon-button"
            className={cn(
              buttonVariants({ variant, size: 'icon' }),
              iconButtonSize[size],
              className,
            )}
            {...props}
          >
            {children}
          </button>
        }
      />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
