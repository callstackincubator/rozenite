import { transformWithEsbuild } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import {
  type RozeniteIntegration,
  ROZENITE_INTEGRATIONS,
  DEFAULT_PLUGIN_INTEGRATIONS,
  isRozeniteIntegration,
} from '@rozenite/tools';

export type PanelEntry = {
  name: string;
  source: string;
};

export type DevPresetEntry = {
  name: string;
  type: string;
  payload: unknown;
};

export type DevFlowMessage = {
  id: string;
  direction: 'in' | 'out';
  date: string;
  type: string;
  payload: unknown;
};

export type DevFlowMessageMatcher =
  | string
  | ((message: DevFlowMessage) => boolean)
  | {
      type?: string;
      direction?: DevFlowMessage['direction'];
      predicate?: (message: DevFlowMessage) => boolean;
    };

export type DevFlowSubscription = {
  remove: () => void;
};

export type DevFlowContext = {
  signal: AbortSignal;
  send: (type: string, payload: unknown) => void;
  onMessage: (
    matcher: DevFlowMessageMatcher,
    listener: (message: DevFlowMessage) => void,
  ) => DevFlowSubscription;
  waitForMessage: (
    matcher: DevFlowMessageMatcher,
    options?: {
      timeoutMs?: number;
    },
  ) => Promise<DevFlowMessage>;
  getMessages: (matcher?: DevFlowMessageMatcher) => DevFlowMessage[];
};

export type DevFlowEntry = {
  name?: string;
  autoRun?: boolean;
  run: (context: DevFlowContext) => unknown | Promise<unknown>;
};

export type DevConfig = {
  presets?: DevPresetEntry[];
  flows?: DevFlowEntry[];
};

export type RozeniteConfig = {
  panels: PanelEntry[];
  dev?: DevConfig;
  /**
   * The target environments this plugin supports. Reported in the plugin
   * manifest (`rozenite.json`) so a consumer can refuse to load a plugin on
   * an integration it doesn't declare, instead of loading it and breaking.
   *
   * @default ['react-native']
   */
  integrations?: RozeniteIntegration[];
  /**
   * Export subpaths of this plugin (e.g. `['./register']`) that the author
   * declares safe to reach a production bundle. Everything else the plugin
   * exports becomes a production build error for consumers, enforced by the
   * bundler's resolver.
   */
  productionEntries?: string[];
};

/**
 * Validates a plugin's declared `integrations` and returns the resolved
 * list — the declaration, or the default when omitted — so the manifest
 * always answers "which integrations does this plugin support", even for a
 * plugin authored before this field existed.
 *
 * Called eagerly from `client-plugin.ts`'s `config()` hook, right after the
 * config is loaded: a typo here must fail the build loudly rather than
 * silently making the plugin unloadable everywhere that later checks it.
 */
export const resolveIntegrations = (config: RozeniteConfig): RozeniteIntegration[] => {
  const integrations = config.integrations ?? DEFAULT_PLUGIN_INTEGRATIONS;

  if (integrations.length === 0) {
    throw new Error(
      `"integrations" in rozenite.config.ts must not be empty. Valid ids: ${ROZENITE_INTEGRATIONS.join(', ')}.`,
    );
  }

  for (const integration of integrations) {
    if (!isRozeniteIntegration(integration)) {
      throw new Error(
        `Invalid integration "${integration}" in rozenite.config.ts. Valid ids: ${ROZENITE_INTEGRATIONS.join(', ')}.`,
      );
    }
  }

  return [...integrations];
};

export const loadConfig = async (configPath: string): Promise<RozeniteConfig> => {
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Configuration file not found: ${absoluteConfigPath}`);
  }

  try {
    const configContent = await fs.promises.readFile(absoluteConfigPath, 'utf-8');

    const result = await transformWithEsbuild(configContent, absoluteConfigPath, {
      loader: 'ts',
      format: 'cjs',
      target: 'esnext',
    });

    const moduleExports: { default?: unknown } = {};
    const module = { exports: moduleExports };
    const exports = moduleExports;

    const moduleFunction = new Function('module', 'exports', result.code);
    moduleFunction(module, exports);

    const configModule = module.exports;
    const config = configModule.default || configModule;

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must export an object');
    }

    return config as RozeniteConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
    }
    throw new Error(`Failed to load configuration from ${configPath}`);
  }
};
