/**
 * Flattens an error into a single human-readable detail string, expanding an
 * `AggregateError` (what Node raises when a dual-stack connect fails on every
 * address) into its members. Returns `null` for falsy input.
 */
export const getErrorDetails = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (
    typeof AggregateError !== 'undefined' &&
    error instanceof AggregateError &&
    error.errors.length > 0
  ) {
    return error.errors
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .join('; ');
  }

  return error instanceof Error ? error.message : String(error);
};
