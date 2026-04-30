export const downloadFile = async (data: unknown, filename: string) => {
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

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

export const formatDuration = (duration: number) => {
  if (duration >= 1000) {
    return `${(duration / 1000).toFixed(2)}s`;
  }
  return `${duration.toFixed(2)}ms`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getMetricMaximumFractionDigits = (
  value: number,
  mode: 'compact' | 'full',
) => {
  if (Number.isInteger(value)) {
    return 0;
  }

  const absoluteValue = Math.abs(value);

  if (mode === 'compact') {
    if (absoluteValue >= 100) {
      return 1;
    }

    if (absoluteValue >= 1) {
      return 2;
    }

    if (absoluteValue >= 0.01) {
      return 4;
    }

    return 6;
  }

  if (absoluteValue >= 100) {
    return 2;
  }

  if (absoluteValue >= 1) {
    return 4;
  }

  if (absoluteValue >= 0.01) {
    return 6;
  }

  return 8;
};

export const getMetricUnit = (detail: unknown): string | null => {
  if (!isRecord(detail)) {
    return null;
  }

  const unit = detail.unit;
  return typeof unit === 'string' && unit.trim() ? unit.trim() : null;
};

export const formatMetricValue = (
  value: string | number,
  options: {
    includeUnit?: boolean;
    mode?: 'compact' | 'full';
    unit?: string | null;
  } = {},
) => {
  const { includeUnit = true, mode = 'compact', unit = null } = options;

  const baseValue =
    typeof value === 'number'
      ? new Intl.NumberFormat(undefined, {
          maximumFractionDigits: getMetricMaximumFractionDigits(value, mode),
          minimumFractionDigits: 0,
        }).format(value)
      : value;

  if (includeUnit && unit) {
    return `${baseValue} ${unit}`;
  }

  return baseValue;
};

export const formatMetricRawValue = (
  value: string | number,
  unit?: string | null,
) => {
  const baseValue = typeof value === 'number' ? String(value) : value;
  return unit ? `${baseValue} ${unit}` : baseValue;
};

export const getMetricValueKind = (value: string | number) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'Integer' : 'Decimal';
  }

  return 'Text';
};
