export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export const normalizePageLimit = (rawLimit: unknown): number => {
  if (rawLimit === undefined) {
    return DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`"limit" must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
};
