import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ArtifactWriteResult = {
  path: string;
  bytes: number;
};

export type ArtifactFileWriter = {
  path: string;
  write: (chunk: string | Buffer) => Promise<void>;
  finalize: () => Promise<ArtifactWriteResult>;
  abort: () => Promise<void>;
};

const waitForEvent = (
  stream: fs.WriteStream,
  event: 'open' | 'finish' | 'close',
): Promise<void> => {
  return new Promise((resolve, reject) => {
    stream.once(event, () => resolve());
    stream.once('error', reject);
  });
};

const validateFilePath = async (filePath: string): Promise<string> => {
  if (!filePath.trim()) {
    throw new Error('"filePath" must be a non-empty string');
  }

  const resolvedPath = path.resolve(filePath);
  const parentDir = path.dirname(resolvedPath);
  await fs.promises.mkdir(parentDir, { recursive: true });

  try {
    const stats = await fs.promises.stat(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(`Artifact output path "${resolvedPath}" is a directory`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return resolvedPath;
};

export const createArtifactFileWriter = async (
  requestedPath: string,
): Promise<ArtifactFileWriter> => {
  const resolvedPath = await validateFilePath(requestedPath);
  const tempPath = `${resolvedPath}.tmp-${randomUUID()}`;
  const stream = fs.createWriteStream(tempPath, { encoding: 'utf8' });
  let bytes = 0;
  let settled = false;

  await waitForEvent(stream, 'open');

  const write = async (chunk: string | Buffer): Promise<void> => {
    if (settled) {
      throw new Error('Artifact writer is already closed');
    }

    const chunkBytes = typeof chunk === 'string'
      ? Buffer.byteLength(chunk, 'utf8')
      : chunk.byteLength;

    await new Promise<void>((resolve, reject) => {
      stream.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }

        bytes += chunkBytes;
        resolve();
      });
    });
  };

  const finalize = async (): Promise<ArtifactWriteResult> => {
    if (settled) {
      throw new Error('Artifact writer is already closed');
    }

    settled = true;
    stream.end();
    await waitForEvent(stream, 'finish');
    await fs.promises.rename(tempPath, resolvedPath);

    return {
      path: resolvedPath,
      bytes,
    };
  };

  const abort = async (): Promise<void> => {
    if (settled) {
      return;
    }

    settled = true;
    stream.destroy();
    await fs.promises.rm(tempPath, { force: true });
  };

  return {
    path: resolvedPath,
    write,
    finalize,
    abort,
  };
};
