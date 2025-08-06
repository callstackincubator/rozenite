export interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  maintainers?: Array<{ name: string; email?: string; url?: string }>;
  repository?: string | { type: string; url: string };
  homepage?: string;
  bugs?: string | { url: string; email?: string };
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dist?: {
    integrity: string;
    shasum: string;
    tarball: string;
    fileCount: number;
    unpackedSize: number;
    'npm-signature'?: string;
  };
  time?: Record<string, string>;
  versions?: Record<string, any>;
  'dist-tags'?: Record<string, string>;
  readme?: string;
  readmeFilename?: string;
  _id: string;
  _rev: string;
}

export interface NpmPackageError {
  error: string;
  reason?: string;
}

async function fetchNpmPackage(
  packageName: string,
  version?: string
): Promise<NpmPackageInfo> {
  try {
    const registryUrl = 'https://registry.npmjs.org';
    const url = version
      ? `${registryUrl}/${packageName}/${version}`
      : `${registryUrl}/${packageName}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'rozenite-website/1.0.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Package "${packageName}"${
            version ? `@${version}` : ''
          } not found in npm registry`
        );
      }

      throw new Error(
        `Failed to fetch package ${packageName} ${version ? `@${version}` : ''}`
      );
    }

    const data = await response.json();
    return data as NpmPackageInfo;
  } catch {
    throw new Error(
      `Failed to fetch package ${packageName} ${version ? `@${version}` : ''}`
    );
  }
}

export function extractPackageNameFromNpmUrl(npmUrl: string): string | null {
  try {
    const url = new URL(npmUrl);

    if (url.hostname !== 'www.npmjs.com' && url.hostname !== 'npmjs.com') {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'package' && pathParts.length >= 2) {
      if (pathParts[1].startsWith('@') && pathParts.length >= 3) {
        return `${pathParts[1]}/${pathParts[2]}`;
      }
      return pathParts[1];
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function getBasicPackageInfo(packageName: string): Promise<{
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}> {
  const result = await fetchNpmPackage(packageName);

  if ('error' in result) {
    throw result.error;
  }

  const latestVersion = result['dist-tags']?.latest;
  const latestPackage = latestVersion ? result.versions?.[latestVersion] : null;

  if (!latestPackage) {
    throw new Error('No latest version found');
  }

  return {
    name: result.name,
    version: latestVersion || 'unknown',
    description: latestPackage.description,
    author:
      typeof latestPackage.author === 'string'
        ? latestPackage.author
        : latestPackage.author?.name,
    homepage: latestPackage.homepage,
    repository:
      typeof latestPackage.repository === 'string'
        ? latestPackage.repository
        : latestPackage.repository?.url,
    license: latestPackage.license,
    keywords: latestPackage.keywords,
  };
}
