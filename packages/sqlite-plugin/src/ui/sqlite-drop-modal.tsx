import { Alert, Button, Dialog, Input, Text } from '@rozenite/ui';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

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

const Emphasis = ({ children }: { children: string }) => (
  <span className="font-mono text-foreground">{children}</span>
);

export const SqliteDropModal = ({ isOpen, target, onClose, onConfirm }: SqliteDropModalProps) => {
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !dropping) {
          onClose();
        }
      }}
    >
      <Dialog.Content
        className="max-w-xl"
        aria-label={`${getModalTitle(target)} ${getModalSubtitle(target)}`}
        showCloseButton={!dropping}
      >
        <Dialog.Header>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
            <Dialog.Title>{getModalTitle(target)}</Dialog.Title>
          </div>
          <Dialog.Description className="font-mono text-xs">
            {getModalSubtitle(target)}
          </Dialog.Description>
        </Dialog.Header>

        <div className="flex flex-col gap-4">
          {target.kind === 'database' ? (
            <p className="text-sm text-muted-foreground">
              This drops every table and view in <Emphasis>{target.databaseName}</Emphasis> —{' '}
              {target.tableCount} table
              {target.tableCount === 1 ? '' : 's'} and {target.viewCount} view
              {target.viewCount === 1 ? '' : 's'}, along with all their rows, indexes and triggers.
              The database file itself is not deleted; it is left empty. This cannot be undone.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This permanently drops <Emphasis>{target.qualifiedName}</Emphasis> and everything it
              owns — rows, indexes and triggers. This cannot be undone.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Text variant="label">SQL to be executed</Text>
            <pre className="max-h-40 overflow-auto border border-border bg-muted px-3 py-2 font-mono text-xs leading-5 text-foreground">
              {target.sql}
            </pre>
          </div>

          <div className="flex flex-col gap-1.5">
            <Text
              variant="caption"
              render={<label htmlFor="sqlite-drop-confirmation-input" />}
              className="text-sm"
            >
              Type the {getConfirmationLabel(target)}{' '}
              <Emphasis>{target.confirmationValue}</Emphasis> to confirm
            </Text>
            <Input
              id="sqlite-drop-confirmation-input"
              name="dropConfirmation"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              value={confirmationInput}
              onChange={(event) => setConfirmationInput(event.target.value)}
              disabled={dropping}
            />
          </div>

          {error ? (
            <Alert tone="danger" aria-live="polite">
              <Alert.Title>Drop Failed</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert>
          ) : null}
        </div>

        <Dialog.Footer>
          <Button tone="neutral" variant="outline" onClick={onClose} disabled={dropping}>
            Cancel
          </Button>
          <Button
            tone="danger"
            onClick={() => void handleConfirm()}
            disabled={dropping || !isConfirmed}
          >
            <Trash2 aria-hidden="true" />
            {dropping ? 'Dropping…' : getModalTitle(target)}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
