import type { TransitionSource } from '../../shared/protocol';

export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};

export const formatDuration = (ms: number | undefined) => {
  if (ms === undefined || !Number.isFinite(ms)) return '';
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const formatRelative = (timestamp: number, now = Date.now()) => {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

/** Short badge text and tone for attribution sources worth calling out. */
export const SOURCE_BADGES: Partial<
  Record<TransitionSource, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }>
> = {
  external: { label: 'external', tone: 'neutral' },
  hydrate: { label: 'hydrate', tone: 'info' },
  edit: { label: 'edit', tone: 'info' },
  named: { label: 'named', tone: 'neutral' },
  anonymous: { label: 'anon', tone: 'warning' },
};
