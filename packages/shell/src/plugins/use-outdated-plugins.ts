import { useEffect, useState } from 'react';
import { getLatestVersions, isNewerVersion } from '../npm/registry';
import type { ShellPlugin } from '../types';

export type OutdatedPluginsResult = {
  status: 'loading' | 'ready' | 'unavailable';
  /** pluginId -> latest published version. Only entries strictly newer
   *  than the installed version are present. */
  outdated: Map<string, string>;
};

const EMPTY_RESULT: OutdatedPluginsResult = { status: 'ready', outdated: new Map() };

/** The only caller of `getLatestVersions` for plugin packages. A plugin's
 *  `id` is its npm package name. */
export function useOutdatedPlugins(plugins: ShellPlugin[]): OutdatedPluginsResult {
  const [result, setResult] = useState<OutdatedPluginsResult>({
    status: 'loading',
    outdated: new Map(),
  });

  useEffect(() => {
    if (plugins.length === 0) {
      setResult(EMPTY_RESULT);
      return;
    }

    let cancelled = false;

    getLatestVersions(plugins.map((plugin) => plugin.id))
      .then((latestVersions) => {
        if (cancelled) {
          return;
        }

        // `getLatestVersions` never rejects; individual package failures are
        // silently omitted from its result instead. An empty result for a
        // non-empty request is therefore the signal that every package
        // failed to resolve, i.e. a registry outage, distinct from "checked
        // and nothing is outdated".
        if (latestVersions.size === 0) {
          setResult({ status: 'unavailable', outdated: new Map() });
          return;
        }

        const outdated = new Map<string, string>();

        for (const plugin of plugins) {
          const latest = latestVersions.get(plugin.id);

          if (latest && isNewerVersion(plugin.version, latest)) {
            outdated.set(plugin.id, latest);
          }
        }

        setResult({ status: 'ready', outdated });
      })
      .catch(() => {
        // Defensive: `getLatestVersions`'s contract never rejects, but a
        // registry outage must never surface an error state in DevTools
        // regardless.
        if (!cancelled) {
          setResult({ status: 'unavailable', outdated: new Map() });
        }
      });

    return () => {
      cancelled = true;
    };
    // `plugins` is derived fresh on every ShellConfiguration update; identity
    // rather than a stable id list would refetch on every render, but shell
    // config only changes when plugins actually change.
  }, [plugins]);

  return result;
}
