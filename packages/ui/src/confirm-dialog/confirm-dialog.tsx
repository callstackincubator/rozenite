import type { ReactNode } from 'react';
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
export function ConfirmDialog({
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
