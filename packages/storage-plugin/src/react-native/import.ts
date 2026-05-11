import type {
  StorageImportEntriesEvent,
  StorageImportResultEvent,
  StorageSetEntryEvent,
} from '../shared/messaging';
import type { StorageView } from './storage-view';

export type ImportEmittedEvent =
  | StorageSetEntryEvent
  | StorageImportResultEvent;

export const handleImportEntries = async (
  views: StorageView[],
  event: StorageImportEntriesEvent,
  emit: (out: ImportEmittedEvent) => void,
): Promise<void> => {
  const view = views.find(
    (candidate) =>
      candidate.target.adapterId === event.target.adapterId &&
      candidate.target.storageId === event.target.storageId,
  );

  if (!view) {
    emit({
      type: 'import-result',
      target: event.target,
      ok: false,
      written: 0,
      total: event.entries.length,
      error: 'Target storage not found',
    });
    return;
  }

  for (let i = 0; i < event.entries.length; i++) {
    const entry = event.entries[i];

    try {
      await view.set(entry);
    } catch (error) {
      emit({
        type: 'import-result',
        target: event.target,
        ok: false,
        written: i,
        total: event.entries.length,
        failedKey: entry.key,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    emit({
      type: 'set-entry',
      target: event.target,
      entry,
    });
  }

  emit({
    type: 'import-result',
    target: event.target,
    ok: true,
    written: event.entries.length,
    total: event.entries.length,
  });
};
