/**
 * Fetches this app's plugin configuration from the middleware, the JSON
 * counterpart of the `__ROZENITE__` global `packages/middleware/src/entry-point.ts`
 * injects into Fusebox's HTML for the embedded shell. This client isn't
 * server-rendered, so the same values are served as JSON instead of an
 * inline script.
 */

export type RozeniteAppConfig = {
  installedPlugins: string[];
  destroyOnDetachPlugins: string[];
  runtimeVersion?: string;
};

// Derived from `import.meta.env.BASE_URL` (Vite bakes it in from
// `vite.config.ts`'s `base`) rather than a second hardcoded copy of the
// mount path — see also `plugins.ts`'s `getPluginBaseUrl`.
const CONFIG_URL = `${import.meta.env.BASE_URL}config`;

/** A failure here — network error or non-2xx response — means Metro isn't
 * reachable at all: the `metroUnreachable` condition. */
export class ConfigFetchError extends Error {}

export const fetchConfig = async (): Promise<RozeniteAppConfig> => {
  let response: Response;
  try {
    response = await fetch(CONFIG_URL);
  } catch (error) {
    throw new ConfigFetchError(
      `Failed to reach "${CONFIG_URL}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new ConfigFetchError(
      `Fetching "${CONFIG_URL}" failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};
