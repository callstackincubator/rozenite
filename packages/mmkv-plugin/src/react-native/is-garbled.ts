// This is a heuristic to determine if a string is garbled.
export const looksLikeGarbled = (str: string): boolean => {
  // 1. Check for replacement character (�)
  if (str.includes('\uFFFD')) return true;

  // 2. Check for unusual control characters
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\u0000-\u001F\u007F-\u009F]/;
  if (controlChars.test(str)) return true;

  // 3. Optionally, check if most chars are non-printable
  const printableRatio =
    [...str].filter((c) => c >= ' ' && c <= '~').length / str.length;
  if (printableRatio < 0.7) return true; // mostly non-printable → probably binary

  return false; // seems like valid string
};
