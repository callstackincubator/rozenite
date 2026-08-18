import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../dialog/dialog';
import { Button } from '../button/button';
import type { Tone } from '../tokens/tone';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  /**
   * `'confirm'` renders Cancel + Confirm buttons; `'alert'` renders a single
   * acknowledgement button and no cancel affordance.
   * @default 'confirm'
   */
  variant?: 'confirm' | 'alert';
  /** Styles the confirm/OK button by tone, e.g. `'danger'` for a destructive action.
   * @default 'primary' */
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

/** A confirmation or acknowledgement dialog for destructive or important actions. */
function ConfirmDialogRoot({
  open,
  onOpenChange,
  title,
  description,
  className,
  variant = 'confirm',
  tone = 'primary',
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  const isAlert = variant === 'alert';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content showCloseButton={false} className={className}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          {description && <Dialog.Description>{description}</Dialog.Description>}
        </Dialog.Header>
        <Dialog.Footer>
          {!isAlert && (
            <Dialog.Close render={<Button tone="neutral" variant="outline" />}>
              {cancelLabel}
            </Dialog.Close>
          )}
          <Dialog.Close render={<Button tone={tone} />} onClick={onConfirm}>
            {confirmLabel ?? (isAlert ? 'OK' : 'Confirm')}
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export type ConfirmDialogOptions = Pick<
  ConfirmDialogProps,
  'title' | 'description' | 'variant' | 'tone' | 'confirmLabel' | 'cancelLabel'
>;

type ConfirmFn = (options: ConfirmDialogOptions) => Promise<boolean>;

type PendingConfirm = {
  id: number;
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
};

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export type ConfirmDialogProviderProps = {
  children?: ReactNode;
};

/**
 * Renders at most one queued confirmation at a time — a second `confirm()`
 * call while one is already showing waits its turn rather than stacking
 * dialogs.
 */
function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const nextIdRef = useRef(0);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      const id = nextIdRef.current++;
      setQueue((current) => [...current, { id, options, resolve }]);
    });
  }, []);

  const pending = queue[0] ?? null;

  const settle = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setQueue((current) => current.filter((entry) => entry.id !== pending.id));
  };

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialogRoot
          {...pending.options}
          open
          onOpenChange={(open) => {
            if (!open) settle(false);
          }}
          onConfirm={() => settle(true)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}

/** Imperatively show a confirmation or acknowledgement dialog. Must be used within a `ConfirmDialog.Provider` (which `PluginShell` mounts automatically). */
export function useConfirmDialog(): ConfirmFn {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialog.Provider');
  }

  return context;
}

export const ConfirmDialog = Object.assign(ConfirmDialogRoot, {
  Provider: ConfirmDialogProvider,
});
