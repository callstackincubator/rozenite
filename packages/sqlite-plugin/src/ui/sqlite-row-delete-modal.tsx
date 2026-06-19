import { AlertDialog, Button, Surface } from '@rozenite/ui';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type SqliteRowDeleteModalProps = {
  isOpen: boolean;
  rowNumber: number;
  entityName: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
};

export const SqliteRowDeleteModal = ({
  isOpen,
  rowNumber,
  entityName,
  onClose,
  onDelete,
}: SqliteRowDeleteModalProps) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await onDelete();
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : String(nextError),
      );
    } finally {
      setDeleting(false);
    }
  };

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
        isDismissable={!deleting}
        variant="opaque"
      >
        <AlertDialog.Container className="w-full max-w-xl" placement="center">
          <AlertDialog.Dialog
            aria-label={`Delete row ${rowNumber} from ${entityName}`}
            className="bg-surface text-foreground"
          >
            <AlertDialog.Header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
              <AlertDialog.Icon status="danger">
                <AlertTriangle className="size-5" />
              </AlertDialog.Icon>
              <div className="min-w-0">
                <AlertDialog.Heading className="text-base font-semibold text-foreground">
                  Delete Row {rowNumber}
                </AlertDialog.Heading>
                <p className="mt-1 text-xs text-muted">{entityName}</p>
              </div>
            </AlertDialog.Header>

            <AlertDialog.Body className="space-y-4 px-5 py-4 text-sm leading-6 text-muted">
              <p>
                This will permanently delete the selected row and immediately
                refetch the current page.
              </p>

              {error ? (
                <Surface
                  aria-live="polite"
                  className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-danger"
                  variant="secondary"
                >
                  <p className="font-medium">Delete Failed</p>
                  <p className="mt-1 text-sm text-danger">{error}</p>
                </Surface>
              ) : null}
            </AlertDialog.Body>

            <AlertDialog.Footer className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                isDisabled={deleting}
                onPress={onClose}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isDisabled={deleting}
                onPress={() => void handleDelete()}
                variant="danger"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {deleting ? 'Deleting…' : 'Delete Row'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
};
