import type { ComponentProps } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';

export type DialogProps = DialogPrimitive.Root.Props;

function DialogRoot(props: DialogProps) {
  return <DialogPrimitive.Root {...props} />;
}

export type DialogTriggerProps = DialogPrimitive.Trigger.Props;

function DialogTrigger(props: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export type DialogCloseProps = DialogPrimitive.Close.Props;

function DialogClose(props: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export type DialogContentProps = DialogPrimitive.Popup.Props & {
  /** Hides the built-in close button in the top-right corner. */
  showCloseButton?: boolean;
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const container = usePluginPortalContainer();

  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className={cn(
          'fixed inset-0 z-50 bg-background/70',
          'transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
        )}
      />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            'relative flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg',
            'transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              aria-label="Close"
              className={cn(
                'absolute top-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

export type DialogHeaderProps = ComponentProps<'div'>;

function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

export type DialogFooterProps = ComponentProps<'div'>;

function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export type DialogTitleProps = DialogPrimitive.Title.Props;

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export type DialogDescriptionProps = DialogPrimitive.Description.Props;

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Close: DialogClose,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
});
