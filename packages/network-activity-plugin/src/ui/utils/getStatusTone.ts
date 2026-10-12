import type { Tone } from '@rozenite/ui';

/**
 * The status tone of a request: an HTTP status code, a socket or stream state,
 * or a request state such as `pending`. Anything without a verdict is neutral.
 */
export const getStatusTone = (status: number | string): Tone => {
  if (typeof status === 'string') {
    if (status === 'open') return 'success';
    if (status === 'connecting') return 'warning';
    if (status === 'closed' || status === 'error' || status === 'failed') return 'danger';
    return 'neutral';
  }

  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'warning';
  if (status >= 400) return 'danger';
  return 'neutral';
};

const STATUS_TEXT_CLASS_NAMES: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/** The text colour class for a status. A neutral status reads as idle, not as body text. */
export const getStatusTextClassName = (status: number | string): string =>
  STATUS_TEXT_CLASS_NAMES[getStatusTone(status)];
