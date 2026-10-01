import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Baselines live in `__snapshots__/<platform>/`, one directory per platform
 * because the iOS and Android networking stacks differ. Next to the snapshot
 * file sits `baseline.json`, recording how the plugin was observed when the
 * baselines were recorded, so a compare run that ends up observing it some
 * other way fails instead of quietly comparing a different shape.
 */

export type BaselineManifest = {
  platform: string;
  observer: string;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_MANIFEST_FILE = 'baseline.json';

export const getSnapshotDir = (platform: string): string =>
  path.join(HERE, '__snapshots__', platform);

const manifestPath = (platform: string) =>
  path.join(getSnapshotDir(platform), BASELINE_MANIFEST_FILE);

export const readBaselineManifest = (platform: string): BaselineManifest | null => {
  const file = manifestPath(platform);
  if (!existsSync(file)) {
    return null;
  }
  return JSON.parse(readFileSync(file, 'utf8')) as BaselineManifest;
};

export const writeBaselineManifest = (manifest: BaselineManifest): void => {
  mkdirSync(getSnapshotDir(manifest.platform), { recursive: true });
  writeFileSync(manifestPath(manifest.platform), `${JSON.stringify(manifest, null, 2)}\n`);
};
