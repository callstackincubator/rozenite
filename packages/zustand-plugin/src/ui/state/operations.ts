import type { EncodedValue, StatePath } from '../../shared/codec';
import { exportHistory } from '../history/model';
import { panelActions, requireRpc, usePanelStore } from './panel-store';

/**
 * Everything the panel asks the device to do. Errors propagate; callers show
 * them as toasts.
 */

/** Restores the device's own copy of the state after `seq`. */
export const jumpTo = (storeId: string, seq: number) =>
  requireRpc().method('jump').invoke({ storeId, seq });

export const setRecording = (storeId: string | null, recording: boolean) =>
  requireRpc()
    .method('setRecording')
    .invoke({ storeId: storeId ?? undefined, recording });

export const editPath = (
  storeId: string,
  path: StatePath,
  value: EncodedValue,
  op: 'set' | 'remove' = 'set',
) => requireRpc().method('editPath').invoke({ storeId, path, value, op });

export const invokeAction = (storeId: string, actionPath: string, args: EncodedValue[]) =>
  requireRpc().method('invokeAction', { timeoutMs: 120_000 }).invoke({ storeId, actionPath, args });

export const loadLazy = (storeId: string, seq: number, path: StatePath) =>
  requireRpc().method('getLazyValue').invoke({ storeId, seq, path });

export const loadRawTrace = (traceId: string) =>
  requireRpc().method('getTrace').invoke({ traceId });

export const persistCommand = (storeId: string, command: 'rehydrate' | 'clear') =>
  requireRpc().method('persistCommand').invoke({ storeId, command });

export const exportToFile = (storeIds?: string[]) => {
  const data = exportHistory(usePanelStore.getState().model, storeIds);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `rozenite-zustand-${storeIds?.length === 1 ? storeIds[0] : 'all'}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return data.stores.length;
};

export const hello = async () => {
  const result = await requireRpc().method('hello', { timeoutMs: 30_000 }).invoke();
  return panelActions.applyHello(result);
};
