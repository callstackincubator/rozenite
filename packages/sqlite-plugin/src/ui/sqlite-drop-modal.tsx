import { Modal, useOverlayState } from '@heroui/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SqliteModalCloseButton, sqliteSecondaryButtonClassName } from './sqlite-modal-controls';

export type SqliteDropModalTarget =
  | {
      kind: 'entity';
      entityType: 'table' | 'view';
      qualifiedName: string;
      confirmationValue: string;
      sql: string;
    }
  | {
      kind: 'database';
      databaseName: string;
      confirmationValue: string;
      tableCount: number;
      viewCount: number;
      sql: string;
    };

type SqliteDropModalProps = {
  isOpen: boolean;
  target: SqliteDropModalTarget;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const toneButtonClassName =
  'sqlite-button inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium';
const dangerButtonClassName = `${toneButtonClassName} border border-rose-400/30 bg-rose-500/16 text-rose-50 hover:bg-rose-500/24`;

const getModalTitle = (target: SqliteDropModalTarget) =>
  target.kind === 'entity'
    ? `Drop ${target.entityType === 'view' ? 'View' : 'Table'}`
    : 'Drop All Objects';

const getModalSubtitle = (target: SqliteDropModalTarget) =>
  target.kind === 'entity' ? target.qualifiedName : target.databaseName;

const getConfirmationLabel = (target: SqliteDropModalTarget) =>
  target.kind === 'entity'
    ? `${target.entityType === 'view' ? 'view' : 'table'} name`
    : 'database name';

export const SqliteDropModal = ({ isOpen, target, onClose, onConfirm }: SqliteDropModalProps) => {
  const overlay = useOverlayState({
    isOpen,
    onOpenChange: (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
  });
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDropping(false);
      setError(null);
      setConfirmationInput('');
    }
  }, [isOpen]);

  const isConfirmed = confirmationInput === target.confirmationValue;

  const handleConfirm = async () => {
    if (!isConfirmed) {
      return;
    }

    try {
      setDropping(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setDropping(false);
    }
  };

  return (
    <Modal state={overlay}>
      <Modal.Backdrop
        variant="blur"
        isDismissable={!dropping}
        className="bg-[rgba(5,10,16,0.24)] backdrop-blur-[2px]"
      >
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog
            aria-label={`${getModalTitle(target)} ${getModalSubtitle(target)}`}
            className="w-full max-w-xl overflow-hidden border border-white/10 bg-[#0a121b] p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/12 text-rose-200">
                  <AlertTriangle aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{getModalTitle(target)}</h2>
                  <p className="mt-1 text-sm text-slate-400">{getModalSubtitle(target)}</p>
                </div>
              </div>
              <SqliteModalCloseButton onClose={onClose} disabled={dropping} />
            </div>

            <Modal.Body className="space-y-0 p-0">
              <div className="space-y-5 px-5 py-5">
                {target.kind === 'database' ? (
                  <p className="text-sm leading-6 text-slate-300">
                    This drops every table and view in{' '}
                    <span className="font-medium text-white">{target.databaseName}</span> —{' '}
                    {target.tableCount} table
                    {target.tableCount === 1 ? '' : 's'} and {target.viewCount} view
                    {target.viewCount === 1 ? '' : 's'}, along with all their rows, indexes and
                    triggers. The database file itself is not deleted; it is left empty. This cannot
                    be undone.
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-300">
                    This permanently drops{' '}
                    <span className="font-medium text-white">{target.qualifiedName}</span> and
                    everything it owns — rows, indexes and triggers. This cannot be undone.
                  </p>
                )}

                <div className="space-y-2">
                  <p className="sqlite-helper-text">SQL to be executed</p>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-xs leading-5 text-slate-200">
                    {target.sql}
                  </pre>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sqlite-drop-confirmation-input" className="sqlite-helper-text">
                    Type the {getConfirmationLabel(target)}{' '}
                    <span className="font-medium text-white">{target.confirmationValue}</span> to
                    confirm
                  </label>
                  <input
                    id="sqlite-drop-confirmation-input"
                    type="text"
                    name="dropConfirmation"
                    autoComplete="off"
                    spellCheck={false}
                    className="sqlite-input"
                    value={confirmationInput}
                    onChange={(event) => setConfirmationInput(event.target.value)}
                    disabled={dropping}
                  />
                </div>

                {error ? (
                  <div className="sqlite-inline-error" aria-live="polite">
                    <div>
                      <p className="font-medium text-rose-100">Drop Failed</p>
                      <p className="mt-1 text-sm text-rose-100/90">{error}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/8 px-5 py-5">
                <button
                  type="button"
                  className={sqliteSecondaryButtonClassName}
                  onClick={onClose}
                  disabled={dropping}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={dangerButtonClassName}
                  onClick={() => void handleConfirm()}
                  disabled={dropping || !isConfirmed}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  {dropping ? 'Dropping…' : getModalTitle(target)}
                </button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
