export type JsonInspectionParseMode = 'any' | 'object-or-array';

export type JsonInspectionParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      value: null;
    };

const isInspectableObjectOrArray = (
  value: unknown,
): value is Record<string, unknown> | unknown[] => {
  if (Array.isArray(value)) {
    return true;
  }

  return value !== null && typeof value === 'object';
};

export const parseJsonForInspection = (
  value: string,
  mode: JsonInspectionParseMode = 'object-or-array',
): JsonInspectionParseResult => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (mode === 'object-or-array' && !isInspectableObjectOrArray(parsed)) {
      return { ok: false, value: null };
    }

    return { ok: true, value: parsed };
  } catch {
    return { ok: false, value: null };
  }
};
