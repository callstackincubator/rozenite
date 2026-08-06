const NPM_RUNTIME_URL = 'https://registry.npmjs.org/%40rozenite%2Fruntime/latest';

type NpmPackageMetadata = {
  version?: unknown;
};

async function fetchLatestRuntimeVersion(): Promise<string> {
  const response = await fetch(NPM_RUNTIME_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch the latest Rozenite version: ${response.status}`);
  }

  const metadata = (await response.json()) as NpmPackageMetadata;

  if (typeof metadata.version !== 'string') {
    throw new Error('The npm response did not contain a package version.');
  }

  return metadata.version;
}

export async function getAvailableRuntimeVersion(currentVersion: string): Promise<string | null> {
  const latestVersion = await fetchLatestRuntimeVersion();

  return latestVersion === currentVersion ? null : latestVersion;
}
