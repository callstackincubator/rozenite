import fs from 'node:fs';
import path from 'node:path';

type DevHostManifestEntry = {
  file?: string;
  css?: string[];
};

type DevHostBuildManifest = Record<string, DevHostManifestEntry>;

export type DevHostBuiltAssets = {
  script: string;
  styles: string[];
};

const DEV_HOST_BUILD_ENTRY_KEY = 'index.html';

export const getDevHostHtmlTemplate = () => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rozenite Dev Host</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
};

export const getDevHostSourceEntryFile = (packageDir: string) => {
  return path.join(packageDir, 'src', 'dev-host', 'main.tsx');
};

export const getBuiltDevHostAssets = (packageDir: string): DevHostBuiltAssets | null => {
  const devHostDistDir = path.join(packageDir, 'dist', 'dev-host');
  const manifestPath = path.join(devHostDistDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DevHostBuildManifest;
  const entry = manifest[DEV_HOST_BUILD_ENTRY_KEY];

  if (!entry?.file) {
    throw new Error(`Missing ${DEV_HOST_BUILD_ENTRY_KEY} entry in dev host manifest.`);
  }

  return {
    script: path.join(devHostDistDir, entry.file),
    styles: (entry.css ?? []).map((file) => path.join(devHostDistDir, file)),
  };
};
