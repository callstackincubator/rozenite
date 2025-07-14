import fs from 'node:fs';
import path from 'node:path';

export const resolveFileWithExtensions = (
  directory: string,
  baseName: string
): string | null => {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  for (const ext of extensions) {
    const filePath = path.join(directory, baseName + ext);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
};

export const memo = <T>(fn: () => T): (() => T) => {
  let result: T | null = null;

  return () => {
    if (result === null) {
      result = fn();
    }

    return result;
  };
};
