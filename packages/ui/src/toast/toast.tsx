import type { ReactNode } from 'react';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';

export const useToast = ToastPrimitive.useToastManager;

export type ToastProviderProps = ToastPrimitive.Provider.Props & {
  children?: ReactNode;
  /** Accessible name for each toast's dismiss button.
   * @default 'Dismiss' */
  dismissLabel?: string;
  /** Overrides the viewport's position and size, e.g. to dock it elsewhere
   * than the bottom-right corner.
   * @default 'fixed right-4 bottom-4 w-80' */
  viewportClassName?: string;
};

/** Alias for `ToastProviderProps` — `Toast` itself is callable, so this is the props type most callers want. */
export type ToastProps = ToastProviderProps;

function ToastProviderRoot({
  children,
  dismissLabel = 'Dismiss',
  viewportClassName,
  ...props
}: ToastProviderProps) {
  return (
    <ToastPrimitive.Provider data-slot="toast-provider" {...props}>
      {children}
      <Toaster dismissLabel={dismissLabel} viewportClassName={viewportClassName} />
    </ToastPrimitive.Provider>
  );
}

function Toaster({
  dismissLabel,
  viewportClassName,
}: {
  dismissLabel: string;
  viewportClassName?: string;
}) {
  const { toasts } = ToastPrimitive.useToastManager();
  const container = usePluginPortalContainer();

  return (
    <ToastPrimitive.Portal container={container}>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className={cn('fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2', viewportClassName)}
      >
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
              'relative flex items-start gap-2 rounded-md border border-border bg-card p-3 text-card-foreground shadow-md',
              'transition-[transform,opacity] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
              toast.type === 'error' && 'border-danger/50 text-danger',
            )}
          >
            <ToastPrimitive.Content
              data-slot="toast-content"
              className="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              {toast.title && (
                <ToastPrimitive.Title data-slot="toast-title" className="text-sm font-medium" />
              )}
              {toast.description && (
                <ToastPrimitive.Description
                  data-slot="toast-description"
                  className="text-xs text-muted-foreground"
                />
              )}
            </ToastPrimitive.Content>
            <ToastPrimitive.Close
              data-slot="toast-close"
              aria-label={dismissLabel}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

/** A provider for transient notifications that appear above the current view. */
export const Toast = Object.assign(ToastProviderRoot, {
  /** @deprecated Use `Toast` directly — the root itself is now callable, like every other namespace in this package. Removed in a future minor. */
  Provider: ToastProviderRoot,
});
