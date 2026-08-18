/**
 * Loads plugin manifests over HTTP and maps them to the shell's
 * `ShellPlugin` shape. Ported from `packages/runtime/src/plugin-loader.ts`,
 * `manifest.ts`, and `dev-mode.ts` rather than imported from
 * `@rozenite/runtime`: that package's Vite build uses
 * `inlineDynamicImports: true` with a single entry, so it can't gain a
 * second export without risking splitting `host.js` into chunks the
 * middleware never serves. Keep this in sync with the original if that
 * protocol ever changes.
 */
import type { ShellPlugin } from '@rozenite/shell';

type RozeniteManifest = {
  name: string;
  version: string;
  description: string;
  panels: {
    name: string;
    source: string;
  }[];
};

/** Must match `config.server.port` in `packages/vite-plugin`
 * (`rozeniteClientPlugin`) — the port a plugin author's `rozenite dev` runs
 * on. */
const DEV_SERVER_URL = 'http://localhost:8888';

/** Mirrors `packages/runtime/src/plugin-loader.ts`'s `getPluginUrl`,
 * including its non-global `replace('/', '_')` (a scoped package name has
 * exactly one `/`, so this is deliberate parity, not an oversight). */
export const getPluginBaseUrl = (pluginId: string): string => {
  const url = new URL(location.href);
  url.search = '';
  url.pathname = '/rozenite/plugins/' + pluginId.replace('/', '_');
  return url.toString();
};

const getManifest = async (baseUrl: string): Promise<RozeniteManifest> => {
  const response = await fetch(baseUrl + '/rozenite.json');
  if (!response.ok) {
    throw new Error(
      `Failed to fetch plugin manifest from "${baseUrl}/rozenite.json": ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

const toShellPlugin = (baseUrl: string, id: string, manifest: RozeniteManifest): ShellPlugin => ({
  id,
  name: manifest.name,
  description: manifest.description,
  version: manifest.version,
  panels: manifest.panels.map((panel) => ({
    id: `${id}:${panel.name}`,
    name: panel.name,
    source: baseUrl + panel.source,
  })),
});

export const loadPluginFromUrl = async (
  baseUrl: string,
  pluginId?: string,
): Promise<ShellPlugin> => {
  const manifest = await getManifest(baseUrl);
  const id = pluginId ?? manifest.name;
  return toShellPlugin(baseUrl, id, manifest);
};

export const loadPlugin = async (pluginId: string): Promise<ShellPlugin> => {
  return loadPluginFromUrl(getPluginBaseUrl(pluginId), pluginId);
};

/** Tries the local dev server a plugin author's `rozenite dev` starts.
 * Absent (the common case — most users aren't developing a plugin right
 * now) or unreachable, this fails silently: there is nothing to report,
 * only nothing to add. */
export const loadDevModePlugin = async (): Promise<ShellPlugin | null> => {
  try {
    return await loadPluginFromUrl(DEV_SERVER_URL);
  } catch {
    return null;
  }
};

/**
 * Loads every installed plugin plus, if present, the dev-mode plugin. A
 * single plugin failing to load (a bad manifest, a plugin removed from
 * disk, a network hiccup) is logged and skipped rather than failing the
 * whole batch — unlike `packages/runtime/src/index.ts`'s
 * `Promise.all(plugins.map(loadPlugin))`, which is fine to let reject
 * there (a fatal failure just reruns Fusebox), but would take this whole
 * app down.
 */
export const loadPlugins = async (installedPlugins: string[]): Promise<ShellPlugin[]> => {
  const results = await Promise.allSettled(installedPlugins.map((id) => loadPlugin(id)));

  const plugins: ShellPlugin[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      plugins.push(result.value);
    } else {
      console.error('[rozenite] Failed to load plugin.', result.reason);
    }
  }

  const devModePlugin = await loadDevModePlugin();
  if (devModePlugin) {
    plugins.push(devModePlugin);
  }

  return plugins;
};
