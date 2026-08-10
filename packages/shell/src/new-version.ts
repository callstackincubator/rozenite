import { getLatestVersions, isNewerVersion } from './npm/registry';

const RUNTIME_PACKAGE_NAME = '@rozenite/runtime';

export async function getAvailableRuntimeVersion(currentVersion: string): Promise<string | null> {
  const latestVersions = await getLatestVersions([RUNTIME_PACKAGE_NAME]);
  const latestVersion = latestVersions.get(RUNTIME_PACKAGE_NAME);

  if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) {
    return null;
  }

  return latestVersion;
}
