import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '../utils/cn';

export type SwitchProps = SwitchPrimitive.Root.Props;

/** A two-state control for enabling or disabling an option. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border border-input bg-muted transition-colors',
        'data-[checked]:border-primary data-[checked]:bg-primary',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none absolute top-1/2 left-0.5 h-4 w-4 -translate-y-1/2 rounded-full bg-background shadow-xs transition-transform',
          'data-[checked]:translate-x-4',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
