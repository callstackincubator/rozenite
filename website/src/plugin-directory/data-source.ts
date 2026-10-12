import * as path from 'node:path';
import * as fs from 'node:fs';
import { getRepositoryStars } from './clients/github-client';
import { HttpError } from './clients/http-client';
import { getNpmPackageInfo } from './clients/npm-client';
import type { RozenitePluginEntry, ValidatedPluginReference } from './types';
import { validatePluginReferences } from './utils';

export const getPluginReferences = async (): Promise<ValidatedPluginReference[]> => {
  let plugins: unknown;

  try {
    plugins = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '../plugin-directory.json'), 'utf8'),
    );
  } catch (error) {
    throw new Error(
      `Failed to read plugin directory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }

  return validatePluginReferences(plugins);
};

// Set by the deploy workflow. Strict builds fail rather than ship a directory with wrong data.
const isStrict = () => process.env.PLUGIN_DIRECTORY_STRICT === 'true';

// A strict build fails when an official plugin cannot be loaded, or when any request fails for a
// reason other than 404. A third-party package or repository that is gone (404) still degrades.
// Everything else degrades: the card is shown without the data, and the failure is logged.
const handleFailure = (packageName: string, isOfficial: boolean, error: unknown): void => {
  const status = error instanceof HttpError ? error.status : undefined;

  if (isStrict() && (isOfficial || status !== 404)) {
    throw error;
  }

  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[plugin-directory] ${packageName}: ${detail}`);
};

const loadPlugin = async (reference: ValidatedPluginReference): Promise<RozenitePluginEntry> => {
  const { packageName, owner, repo, npmUrl, githubUrl } = reference;
  const isOfficial = packageName.startsWith('@rozenite/');

  const [npm, stars] = await Promise.allSettled([
    getNpmPackageInfo(packageName),
    getRepositoryStars(owner, repo),
  ]);

  if (npm.status === 'rejected') handleFailure(packageName, isOfficial, npm.reason);
  if (stars.status === 'rejected') handleFailure(packageName, isOfficial, stars.reason);

  return {
    packageName,
    npmUrl,
    githubUrl,
    isOfficial,
    version: npm.status === 'fulfilled' ? npm.value.version : undefined,
    description: npm.status === 'fulfilled' ? npm.value.description : undefined,
    stars: stars.status === 'fulfilled' ? stars.value : undefined,
  };
};

export const getPlugins = (
  references: ValidatedPluginReference[],
): Promise<RozenitePluginEntry[]> => Promise.all(references.map(loadPlugin));
