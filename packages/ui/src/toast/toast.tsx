import type { ReactNode } from 'react';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginPortalContainer } from '../theme/theme-context';

export const useToast = ToastPrimitive.useToastManager;

export type ToastProviderProps = ToastPrimitive.Provider.Props & {
  children?: ReactNode;
};

function ToastProviderRoot({ children, ...props }: ToastProviderProps) {
  return (
    <ToastPrimitive.Provider data-slot="toast-provider" {...props}>
      {children}
      <Toaster />
    </ToastPrimitive.Provider>
  );
}

function Toaster() {
  const { toasts } = ToastPrimitive.useToastManager();
  const container = usePluginPortalContainer();

  return (
    <ToastPrimitive.Portal container={container}>
      <ToastPrimitive.Viewport
        data-slot="toast-viewport"
        className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
              'relative flex items-start gap-2 rounded-md border border-border bg-card p-3 text-card-foreground shadow-md',
              'transition-[transform,opacity] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
              toast.type === 'error' && 'border-destructive/50 text-destructive',
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
              aria-label="Dismiss"
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
export const Toast = { Provider: ToastProviderRoot };
