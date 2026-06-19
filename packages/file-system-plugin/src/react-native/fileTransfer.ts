import type { FsEntry } from '../shared/protocol';
import { joinPath, normalizeDirPath } from '../shared/path';
import type { FileSystemAdapter, FileSystemRoot } from './fileSystemProvider';

export type ExportedFileTransfer = {
  provider: FileSystemAdapter['provider'];
  path: string;
  fileName: string;
  mime: string;
  size: number | null;
  base64: string;
};

export type ImportedFileTransfer = {
  provider: FileSystemAdapter['provider'];
  directoryPath: string;
  path?: string;
  entry?: FsEntry;
  overwriteRequired?: boolean;
};

export async function exportFileTransfer(
  provider: FileSystemAdapter,
  path: string,
): Promise<ExportedFileTransfer> {
  if (!provider.readFileBase64) {
    throw new Error('The active filesystem adapter does not support export.');
  }

  const roots = await provider.getRoots();
  assertInsideRoots(path, roots);
  const entry = await provider.statPath(path);

  if (entry.isDirectory) {
    throw new Error(`Path "${entry.path}" is a directory, not a file.`);
  }

  const file = await provider.readFileBase64(entry.path);

  return {
    provider: provider.provider,
    path: entry.path,
    fileName: file.fileName,
    mime: file.mime,
    size: file.size,
    base64: file.base64,
  };
}

export async function importFileTransfer(
  provider: FileSystemAdapter,
  {
    directoryPath,
    fileName,
    base64,
    overwrite = false,
  }: {
    directoryPath: string;
    fileName: string;
    base64: string;
    overwrite?: boolean;
  },
): Promise<ImportedFileTransfer> {
  if (!provider.writeFileBase64) {
    throw new Error('The active filesystem adapter does not support import.');
  }

  assertSafeFileName(fileName);
  const roots = await provider.getRoots();
  const normalizedDirectoryPath = normalizeDirPath(directoryPath);
  assertInsideRoots(normalizedDirectoryPath, roots);

  const directory = await provider.statPath(normalizedDirectoryPath);
  if (!directory.isDirectory) {
    throw new Error(`Path "${directory.path}" is not a directory.`);
  }

  const destinationPath = joinPath(directory.path, fileName);
  assertInsideRoots(destinationPath, roots);

  if (!overwrite && (await pathExists(provider, destinationPath))) {
    return {
      provider: provider.provider,
      directoryPath: directory.path,
      path: destinationPath,
      overwriteRequired: true,
    };
  }

  const entry = await provider.writeFileBase64(destinationPath, base64);

  return {
    provider: provider.provider,
    directoryPath: directory.path,
    path: entry.path,
    entry,
  };
}

export async function pathExists(
  provider: FileSystemAdapter,
  path: string,
): Promise<boolean> {
  if (provider.pathExists) {
    return provider.pathExists(path);
  }

  try {
    await provider.statPath(path);
    return true;
  } catch {
    return false;
  }
}

export function assertInsideRoots(
  path: string,
  roots: FileSystemRoot[],
): void {
  if (hasTraversalSegment(path)) {
    throw new Error('Path must not contain traversal segments.');
  }

  const isInside = roots.some((root) => {
    const rootPath = normalizeDirPath(root.path);
    return path === rootPath || path.startsWith(rootPath);
  });

  if (!isInside) {
    throw new Error('Path is outside the configured filesystem roots.');
  }
}

export function assertSafeFileName(fileName: string): void {
  if (
    !fileName ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    throw new Error('Imported file name must be a single file name.');
  }
}

function hasTraversalSegment(path: string): boolean {
  return path
    .replace(/^file:\/\//, '')
    .split('/')
    .some((segment) => segment === '..');
}
