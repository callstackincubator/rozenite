/**
 * Whether `value` can survive the underlying transport.
 *
 * The transport is CDP/JSON-based today, but the protocol spec talks about
 * "structured-cloneable" payloads, so we prefer the platform's own
 * `structuredClone` when it's available (Node, browsers) and fall back to a
 * `JSON.stringify` probe on runtimes that don't implement it (older Hermes).
 */
export const isCloneable = (value: unknown): boolean => {
  if (typeof structuredClone === 'function') {
    try {
      structuredClone(value);
      return true;
    } catch {
      return false;
    }
  }

  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};
