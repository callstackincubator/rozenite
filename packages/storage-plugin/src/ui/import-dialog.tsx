import { Badge, Button, Dialog } from '@rozenite/ui';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { StorageEntry, StorageTarget } from '../shared/types';
import type { ImportPreview, StorageSnapshotV1 } from '../shared/snapshot';

export type ImportFlightState =
  | {
      phase: 'preview';
      target: StorageTarget;
      targetLabel: string;
      snapshot: StorageSnapshotV1;
      preview: ImportPreview;
      entriesToWrite: StorageEntry[];
    }
  | {
      phase: 'importing';
      requestId: string;
      target: StorageTarget;
      total: number;
      written: number;
    }
  | {
      phase: 'result';
      ok: true;
      written: number;
    }
  | {
      phase: 'result';
      ok: false;
      written: number;
      total: number;
      failedKey?: string;
      error: string;
    };

export type ImportDialogProps = {
  state: ImportFlightState | null;
  onApply: () => void;
  onCancel: () => void;
  onClose: () => void;
};

const KeyList = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium text-foreground">
        {title} ({items.length})
      </div>
      <div className="mt-1 max-h-24 overflow-auto rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
        {items.slice(0, 50).join(', ')}
        {items.length > 50 ? `, +${items.length - 50} more` : ''}
      </div>
    </div>
  );
};

const StatTile = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md bg-muted p-2">
    <div className="text-muted-foreground">{label}</div>
    <div className="text-base font-semibold text-foreground">{value}</div>
  </div>
);

const PreviewBody = ({
  state,
  onApply,
  onCancel,
}: {
  state: Extract<ImportFlightState, { phase: 'preview' }>;
  onApply: () => void;
  onCancel: () => void;
}) => {
  const { snapshot, preview, entriesToWrite, targetLabel } = state;
  const hasUnsupported = preview.unsupportedTypes.length > 0;
  const sourceLabel = `${snapshot.storage.adapterName} / ${snapshot.storage.storageName}`;

  return (
    <>
      <div className="flex flex-col gap-3">
        {preview.metadataMismatch && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              This file was exported from <strong>{sourceLabel}</strong>. You are importing into{' '}
              <strong>{targetLabel}</strong>.
            </div>
          </div>
        )}

        {hasUnsupported && (
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {preview.unsupportedTypes.length}{' '}
              {preview.unsupportedTypes.length === 1 ? 'entry has a type' : 'entries have types'}{' '}
              not supported by this storage. Remove them from the file and try again.
              <div className="mt-1 max-h-20 overflow-auto rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {preview.unsupportedTypes.map((u) => `${u.key} (${u.type})`).join(', ')}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <StatTile label="New" value={preview.newKeys.length} />
          <StatTile label="Overwrite" value={preview.overwriteKeys.length} />
          <StatTile label="Skipped" value={preview.skippedKeys.length} />
        </div>

        <KeyList title="New keys" items={preview.newKeys} />
        <KeyList title="Overwrite keys" items={preview.overwriteKeys} />
        <KeyList
          title="Skipped (filtered by storage)"
          items={preview.skippedKeys.map((s) => s.key)}
        />
      </div>

      <Dialog.Footer>
        <Button tone="neutral" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onApply} disabled={hasUnsupported}>
          Apply ({entriesToWrite.length})
        </Button>
      </Dialog.Footer>
    </>
  );
};

const ImportingBody = ({
  state,
}: {
  state: Extract<ImportFlightState, { phase: 'importing' }>;
}) => (
  <div className="flex flex-col items-center gap-3 py-6">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    <div className="text-sm text-foreground">
      Importing… {state.written} / {state.total}
    </div>
  </div>
);

const ResultBody = ({
  state,
  onClose,
}: {
  state: Extract<ImportFlightState, { phase: 'result' }>;
  onClose: () => void;
}) => (
  <>
    {state.ok ? (
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <div className="text-sm text-foreground">
          Imported {state.written} {state.written === 1 ? 'entry' : 'entries'}.
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-2 py-2">
        <div className="flex items-center gap-2 text-danger">
          <XCircle className="h-5 w-5" />
          <div className="text-sm font-medium">
            Import failed after {state.written} of {state.total}.
          </div>
        </div>
        {state.failedKey && (
          <div className="text-xs text-muted-foreground">
            Failed at key:{' '}
            <Badge tone="neutral" variant="outline" className="font-mono">
              {state.failedKey}
            </Badge>
          </div>
        )}
        <div className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-danger">
          {state.error}
        </div>
      </div>
    )}

    <Dialog.Footer>
      <Button onClick={onClose} autoFocus>
        Close
      </Button>
    </Dialog.Footer>
  </>
);

export const ImportDialog = ({ state, onApply, onCancel, onClose }: ImportDialogProps) => {
  const title =
    state === null
      ? ''
      : state.phase === 'preview'
        ? 'Import snapshot'
        : state.phase === 'importing'
          ? 'Importing…'
          : state.ok
            ? 'Import complete'
            : 'Import failed';

  // Importing phase: dialog is locked; only the success/failure transition closes it.
  const isDismissible = state !== null && state.phase !== 'importing';

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open && isDismissible) onClose();
      }}
    >
      <Dialog.Content showCloseButton={isDismissible}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>

        {state?.phase === 'preview' && (
          <PreviewBody state={state} onApply={onApply} onCancel={onCancel} />
        )}
        {state?.phase === 'importing' && <ImportingBody state={state} />}
        {state?.phase === 'result' && <ResultBody state={state} onClose={onClose} />}
      </Dialog.Content>
    </Dialog>
  );
};
