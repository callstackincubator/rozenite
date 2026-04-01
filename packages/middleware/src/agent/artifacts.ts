import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ArtifactBucket = 'traces' | 'memory' | 'profiles';

export type ArtifactWriteResult = {
  path: string;
  relativePath: string;
  bytes: number;
  bucket: ArtifactBucket;
  fileName: string;
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

const sanitizePathSegment = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'artifact';
};

const createTimestampPrefix = (): string => {
  return new Date().toISOString().replace(/[:.]/g, '-');
};

const createFileName = (extension: string, nameHint?: string): string => {
  const safeExtension = extension.replace(/^\.+/, '') || 'json';
  const safeHint =
    typeof nameHint === 'string' && nameHint.trim().length > 0
      ? `-${sanitizePathSegment(nameHint)}`
      : '';

  return `${createTimestampPrefix()}${safeHint}.${safeExtension}`;
};

export const createAgentArtifacts = (
  projectRoot: string,
  sessionId: string,
) => {
  const sessionRoot = path.join(
    projectRoot,
    '.rozenite',
    'agent',
    'sessions',
    sanitizePathSegment(sessionId),
  );

  const createWriter = async (
    bucket: ArtifactBucket,
    extension: string,
    nameHint?: string,
  ): Promise<ArtifactFileWriter> => {
    const bucketDir = path.join(sessionRoot, bucket);
    await fs.promises.mkdir(bucketDir, { recursive: true });

    const fileName = createFileName(extension, nameHint);
    const resolvedPath = path.join(bucketDir, fileName);
    const tempPath = `${resolvedPath}.tmp-${randomUUID()}`;
    const stream = fs.createWriteStream(tempPath, { encoding: 'utf8' });
    let bytes = 0;
    let settled = false;

    await waitForEvent(stream, 'open');

    const write = async (chunk: string | Buffer): Promise<void> => {
      if (settled) {
        throw new Error('Artifact writer is already closed');
      }

      const chunkBytes =
        typeof chunk === 'string'
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
        relativePath: path.relative(projectRoot, resolvedPath),
        bytes,
        bucket,
        fileName,
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

  return {
    sessionRoot,
    createWriter,
  };
};
