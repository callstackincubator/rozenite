import { Modal, useOverlayState } from '@heroui/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SqliteModalCloseButton, sqliteSecondaryButtonClassName } from './sqlite-modal-controls';

type SqliteRowDeleteModalProps = {
  isOpen: boolean;
  rowNumber: number;
  entityName: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
};

const toneButtonClassName =
  'sqlite-button inline-flex items-center justify-center gap-2 rounded-none px-3 py-2 text-sm font-medium';
const dangerButtonClassName = `${toneButtonClassName} sqlite-button-danger`;

export const SqliteRowDeleteModal = ({
  isOpen,
  rowNumber,
  entityName,
  onClose,
  onDelete,
}: SqliteRowDeleteModalProps) => {
  const overlay = useOverlayState({
    isOpen,
    onOpenChange: (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
  });
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
    <Modal state={overlay}>
      <Modal.Backdrop variant="blur" isDismissable={!deleting} className="bg-black/60">
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog
            aria-label={`Delete row ${rowNumber} from ${entityName}`}
            className="w-full max-w-xl overflow-hidden border border-[var(--sqlite-line-strong)] bg-[var(--sqlite-surface)] p-0 text-white"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--sqlite-line)] px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-none bg-[var(--sqlite-danger-soft)] text-[var(--sqlite-danger)]">
                  <AlertTriangle aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Delete Row {rowNumber}</h2>
                  <p className="mt-1 text-sm text-[var(--sqlite-muted)]">{entityName}</p>
                </div>
              </div>
              <SqliteModalCloseButton onClose={onClose} disabled={deleting} />
            </div>

            <Modal.Body className="space-y-0 p-0">
              <div className="space-y-5 px-5 py-5">
                <p className="text-sm leading-6 text-[var(--sqlite-muted)]">
                  This will permanently delete the selected row and immediately refetch the current
                  page.
                </p>

                {error ? (
                  <div className="sqlite-inline-error" aria-live="polite">
                    <div>
                      <p className="font-medium text-[var(--sqlite-danger)]">Delete Failed</p>
                      <p className="mt-1 text-sm text-[var(--sqlite-danger)]">{error}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[var(--sqlite-line)] px-5 py-5">
                <button
                  type="button"
                  className={sqliteSecondaryButtonClassName}
                  onClick={onClose}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={dangerButtonClassName}
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  {deleting ? 'Deleting…' : 'Delete Row'}
                </button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
