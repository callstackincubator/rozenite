export function newRequestId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export const formatDuration = (durationMs?: number | null) => {
  if (durationMs == null || Number.isNaN(durationMs)) {
    return '—';
  }

  if (durationMs < 1) {
    return `${durationMs.toFixed(2)} ms`;
  }

  if (durationMs < 100) {
    return `${durationMs.toFixed(1)} ms`;
  }

  return `${Math.round(durationMs)} ms`;
};

export const formatNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat().format(value);
};

export const truncateText = (value: string, maxLength = 180) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
};

export const copyToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
};

export const downloadTextFile = (fileName: string, content: string) => {
  if (typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
  return true;
};

export const slugifyFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sqlite-export';
