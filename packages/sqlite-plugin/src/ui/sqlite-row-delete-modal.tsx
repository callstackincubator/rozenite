import { Alert, Button, Dialog } from '@rozenite/ui';
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
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !deleting) {
          onClose();
        }
      }}
    >
      <Dialog.Content
        className="max-w-xl"
        aria-label={`Delete row ${rowNumber} from ${entityName}`}
        showCloseButton={!deleting}
      >
        <Dialog.Header>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
            <Dialog.Title>Delete Row {rowNumber}</Dialog.Title>
          </div>
          <Dialog.Description className="font-mono text-xs">{entityName}</Dialog.Description>
        </Dialog.Header>

        <p className="text-sm text-muted-foreground">
          This will permanently delete the selected row and immediately refetch the current page.
        </p>

        {error ? (
          <Alert tone="danger" aria-live="polite">
            <Alert.Title>Delete Failed</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert>
        ) : null}

        <Dialog.Footer>
          <Button tone="neutral" variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button tone="danger" onClick={() => void handleDelete()} disabled={deleting}>
            <Trash2 aria-hidden="true" />
            {deleting ? 'Deleting…' : 'Delete Row'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
