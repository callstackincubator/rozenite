// Ported from packages/middleware/src/agent/runtime/bindings.ts. Copied
// rather than imported: @rozenite/middleware is a Node-only package and
// this module runs in the browser, so it cannot be a dependency here.
// Keep this in sync with the original if that protocol ever changes.

type RecordValue = Record<string, unknown>;

const getRecord = (value: unknown): RecordValue | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecordValue;
  }
  return null;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

export type BindingPayload = {
  domain: string;
  message?: unknown;
};

export const parseRozeniteBindingPayload = (message: unknown): BindingPayload | null => {
  const record = getRecord(message);
  if (!record || record.method !== 'Runtime.bindingCalled') {
    return null;
  }

  const params = getRecord(record.params);
  const rawPayload = getString(params?.payload);
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    const payload = getRecord(parsed);
    const domain = getString(payload?.domain);
    if (!domain) {
      return null;
    }

    return {
      domain,
      message: payload?.message,
    };
  } catch {
    return null;
  }
};
