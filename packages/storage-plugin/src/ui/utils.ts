import type { StorageTarget } from '../shared/types';

export const downloadJson = (data: unknown, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export const buildExportFilename = (
  target: StorageTarget,
  now: Date = new Date(),
): string => {
  const yyyy = now.getFullYear().toString().padStart(4, '0');
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const mi = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  return `rozenite-storage-${sanitize(target.adapterId)}-${sanitize(target.storageId)}-${timestamp}.json`;
};
