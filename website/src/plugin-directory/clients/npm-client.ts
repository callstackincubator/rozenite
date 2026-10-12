import { getJson, HttpError } from './http-client';

export type NpmPackageInfo = {
  version: string;
  description?: string;
};

// `/latest` returns only the latest manifest (about 3 KB), not the whole packument.
export async function getNpmPackageInfo(packageName: string): Promise<NpmPackageInfo> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  const manifest = await getJson<{ version?: unknown; description?: unknown }>(url, {
    Accept: 'application/json',
    'User-Agent': 'rozenite-website',
  });

  if (typeof manifest?.version !== 'string' || manifest.version === '') {
    throw new HttpError(`GET ${url} returned no version`, url);
  }

  return {
    version: manifest.version,
    description:
      typeof manifest.description === 'string' && manifest.description !== ''
        ? manifest.description
        : undefined,
  };
}
