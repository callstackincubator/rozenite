import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import { cn } from '../utils/cn';

export type SeparatorProps = SeparatorPrimitive.Props;

/** A visual divider between related content or actions. */
export function Separator({ orientation = 'horizontal', className, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'vertical' ? 'h-4 w-px' : 'h-px w-full',
        className,
      )}
      {...props}
    />
  );
}
