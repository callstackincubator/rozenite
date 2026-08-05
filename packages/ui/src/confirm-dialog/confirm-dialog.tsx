import type { ReactNode } from 'react';
import { Dialog } from '../dialog/dialog';
import { Button } from '../button/button';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /**
   * `'confirm'` renders Cancel + Confirm buttons; `'alert'` renders a single
   * acknowledgement button and no cancel affordance.
   * @default 'confirm'
   */
  variant?: 'confirm' | 'alert';
  /** Styles the confirm/OK button as destructive. */
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'confirm',
  destructive = false,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  const isAlert = variant === 'alert';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          {description && (
            <Dialog.Description>{description}</Dialog.Description>
          )}
        </Dialog.Header>
        <Dialog.Footer>
          {!isAlert && (
            <Dialog.Close render={<Button variant="outline" />}>
              {cancelLabel}
            </Dialog.Close>
          )}
          <Dialog.Close
            render={
              <Button variant={destructive ? 'destructive' : 'default'} />
            }
            onClick={onConfirm}
          >
            {confirmLabel ?? (isAlert ? 'OK' : 'Confirm')}
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
