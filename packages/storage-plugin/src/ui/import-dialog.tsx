import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
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
      <div className="text-xs font-medium text-gray-300">
        {title} ({items.length})
      </div>
      <div className="mt-1 max-h-24 overflow-auto rounded bg-gray-900 px-2 py-1 font-mono text-xs text-gray-200">
        {items.slice(0, 50).join(', ')}
        {items.length > 50 ? `, +${items.length - 50} more` : ''}
      </div>
    </div>
  );
};

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
      <div className="space-y-3">
        {preview.metadataMismatch && (
          <div className="flex items-start gap-2 rounded border border-yellow-700 bg-yellow-900/30 p-2 text-xs text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              This file was exported from <strong>{sourceLabel}</strong>. You
              are importing into <strong>{targetLabel}</strong>.
            </div>
          </div>
        )}

        {hasUnsupported && (
          <div className="flex items-start gap-2 rounded border border-red-700 bg-red-900/30 p-2 text-xs text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              {preview.unsupportedTypes.length}{' '}
              {preview.unsupportedTypes.length === 1
                ? 'entry has a type'
                : 'entries have types'}{' '}
              not supported by this storage. Remove them from the file and try
              again.
              <div className="mt-1 max-h-20 overflow-auto rounded bg-gray-900 px-2 py-1 font-mono text-xs text-red-100">
                {preview.unsupportedTypes
                  .map((u) => `${u.key} (${u.type})`)
                  .join(', ')}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-400">New</div>
            <div className="text-base font-semibold text-green-400">
              {preview.newKeys.length}
            </div>
          </div>
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-400">Overwrite</div>
            <div className="text-base font-semibold text-yellow-400">
              {preview.overwriteKeys.length}
            </div>
          </div>
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-400">Skipped</div>
            <div className="text-base font-semibold text-gray-400">
              {preview.skippedKeys.length}
            </div>
          </div>
        </div>

        <KeyList title="New keys" items={preview.newKeys} />
        <KeyList title="Overwrite keys" items={preview.overwriteKeys} />
        <KeyList
          title="Skipped (filtered by storage)"
          items={preview.skippedKeys.map((s) => s.key)}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={hasUnsupported}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          Apply ({entriesToWrite.length})
        </button>
      </div>
    </>
  );
};

const ImportingBody = ({
  state,
}: {
  state: Extract<ImportFlightState, { phase: 'importing' }>;
}) => (
  <div className="flex flex-col items-center gap-3 py-6">
    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
    <div className="text-sm text-gray-200">
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
        <CheckCircle2 className="h-8 w-8 text-green-400" />
        <div className="text-sm text-gray-200">
          Imported {state.written} {state.written === 1 ? 'entry' : 'entries'}.
        </div>
      </div>
    ) : (
      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2 text-red-300">
          <XCircle className="h-5 w-5" />
          <div className="text-sm font-medium">
            Import failed after {state.written} of {state.total}.
          </div>
        </div>
        {state.failedKey && (
          <div className="text-xs text-gray-300">
            Failed at key:{' '}
            <span className="font-mono text-gray-100">{state.failedKey}</span>
          </div>
        )}
        <div className="rounded bg-gray-900 px-2 py-1 font-mono text-xs text-red-200">
          {state.error}
        </div>
      </div>
    )}

    <div className="mt-4 flex items-center justify-end">
      <button
        onClick={onClose}
        autoFocus
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
      >
        Close
      </button>
    </div>
  </>
);

export const ImportDialog = ({
  state,
  onApply,
  onCancel,
  onClose,
}: ImportDialogProps) => {
  if (!state) return null;

  const title =
    state.phase === 'preview'
      ? 'Import snapshot'
      : state.phase === 'importing'
        ? 'Importing…'
        : state.ok
          ? 'Import complete'
          : 'Import failed';

  // Importing phase: dialog is locked; only the success/failure transition closes it.
  const isDismissible = state.phase !== 'importing';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={isDismissible ? onClose : undefined}
    >
      <div
        className="mx-4 w-[28rem] max-w-full rounded-lg bg-gray-800 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          {isDismissible && (
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
              title="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {state.phase === 'preview' && (
          <PreviewBody state={state} onApply={onApply} onCancel={onCancel} />
        )}
        {state.phase === 'importing' && <ImportingBody state={state} />}
        {state.phase === 'result' && (
          <ResultBody state={state} onClose={onClose} />
        )}
      </div>
    </div>
  );
};
