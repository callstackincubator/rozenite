import { AlertDialog, Button } from '@rozenite/ui';
import { AlertTriangle, Info } from 'lucide-react';

export type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'confirm' | 'alert';
  confirmText?: string;
  cancelText?: string;
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmDialogProps) => {
  const isConfirm = type === 'confirm';

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <AlertDialog.Backdrop
        className="bg-overlay/70 backdrop-blur-sm"
        variant="opaque"
      >
        <AlertDialog.Container className="w-full max-w-md" placement="center">
          <AlertDialog.Dialog
            aria-label={title}
            className="border border-border/70 bg-surface text-foreground shadow-2xl"
          >
            <AlertDialog.Header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
              <AlertDialog.Icon status={isConfirm ? 'danger' : 'default'}>
                {isConfirm ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <Info className="size-5" />
                )}
              </AlertDialog.Icon>
              <AlertDialog.Heading className="text-base font-semibold text-foreground">
                {title}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="px-5 py-4 text-sm leading-6 text-muted">
              {message}
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
              {isConfirm ? (
                <Button onPress={onClose} variant="secondary">
                  {cancelText}
                </Button>
              ) : null}
              <Button
                onPress={() => {
                  onConfirm();
                  onClose();
                }}
                variant={isConfirm ? 'danger' : 'primary'}
              >
                {isConfirm ? confirmText : 'OK'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
};
