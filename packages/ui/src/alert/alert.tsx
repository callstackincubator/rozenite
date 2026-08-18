import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { surfaceTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

export type AlertProps = ComponentProps<'div'> & {
  /** @default 'neutral' */
  tone?: Tone;
};

function AlertRoot({ tone = 'neutral', className, ...props }: AlertProps) {
  return (
    <div
      // `danger` interrupts and needs an assertive announcement; other tones
      // are informational and should announce politely, like `role="status"`.
      role={tone === 'danger' ? 'alert' : 'status'}
      data-slot="alert"
      className={cn(
        surfaceTone({
          tone,
          variant: 'soft',
          class: 'flex flex-col gap-1 rounded-md border border-current/15 p-3 text-sm',
        }),
        className,
      )}
      {...props}
    />
  );
}

export type AlertTitleProps = ComponentProps<'div'>;

function AlertTitle({ className, ...props }: AlertTitleProps) {
  return <div data-slot="alert-title" className={cn('font-medium', className)} {...props} />;
}

export type AlertDescriptionProps = ComponentProps<'div'>;

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return <div data-slot="alert-description" className={cn('opacity-80', className)} {...props} />;
}

/** A tone-aware strip for surfacing status, warnings, or errors inline. */
export const Alert = Object.assign(AlertRoot, {
  Title: AlertTitle,
  Description: AlertDescription,
});
