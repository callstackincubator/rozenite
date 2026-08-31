import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const updateCSP = (html: string, nonce: string): string => {
  const cspRegex = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"[^>]*>/;
  const cspMatch = html.match(cspRegex);

  if (cspMatch) {
    const originalCSP = cspMatch[1];
    // Add our nonce to the existing script-src directive
    const updatedCSP = originalCSP.replace(
      /script-src\s+([^;]+)/,
      `script-src $1 'nonce-${nonce}'`,
    );

    return html.replace(
      cspRegex,
      `<meta http-equiv="Content-Security-Policy" content="${updatedCSP}" />`,
    );
  }

  throw new Error(
    "Content-Security-Policy not found. Report this as a bug in Rozenite's issue tracker.",
  );
};

/**
 * Everything `__ROZENITE__` carries into the Fusebox-embedded host. An
 * options object rather than a parameter list: each field otherwise lands
 * in the middle of a run of same-typed positional arguments, where a
 * transposition still type-checks.
 *
 * There is deliberately no host integration here. This global only exists
 * on the Fusebox-embedded path, which `getMiddleware` serves solely when
 * the host is `react-native` — a Lynx dev server never registers
 * `/rn_fusebox.html` at all — so the embedded host already knows its own
 * half of the answer without being told.
 */
export type EntryPointOptions = {
  installedPlugins: string[];
  destroyOnDetachPlugins: string[];
  pluginDisplay?: 'tabs' | 'sidebar';
  runtimeVersion?: string;
};

const appendScripts = (
  html: string,
  nonce: string,
  {
    installedPlugins,
    destroyOnDetachPlugins,
    pluginDisplay = 'sidebar',
    runtimeVersion,
  }: EntryPointOptions,
): string => {
  const bodyTagRegex = /<body[^>]*>/;
  const bodyMatch = html.match(bodyTagRegex);

  const scriptContent = `
    <script type="module" src="./host.js"></script>
    <script nonce="${nonce}">
      var __ROZENITE__ = {
        installedPlugins: ${JSON.stringify(installedPlugins)},
        destroyOnDetachPlugins: ${JSON.stringify(destroyOnDetachPlugins)},
        pluginDisplay: ${JSON.stringify(pluginDisplay)},
        runtimeVersion: ${JSON.stringify(runtimeVersion)},
      };
    </script>
  `;

  if (!bodyMatch) {
    throw new Error("Body tag not found. Report this as a bug in Rozenite's issue tracker.");
  }

  const bodyTag = bodyMatch[0];
  const bodyIndex = html.indexOf(bodyTag);

  return html.substring(0, bodyIndex) + scriptContent + html.substring(bodyIndex);
};

export const getEntryPointHTML = (
  rnDevToolsFrontendPath: string,
  options: EntryPointOptions,
): string => {
  const nonce = crypto.randomUUID();
  const originalEntryPoint = fs.readFileSync(
    path.join(rnDevToolsFrontendPath, 'rn_fusebox.html'),
    'utf8',
  );

  return appendScripts(updateCSP(originalEntryPoint, nonce), nonce, options);
};
