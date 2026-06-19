import { transformWithEsbuild } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

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
};

export const loadConfig = async (
  configPath: string
): Promise<RozeniteConfig> => {
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Configuration file not found: ${absoluteConfigPath}`);
  }

  try {
    const configContent = await fs.promises.readFile(
      absoluteConfigPath,
      'utf-8'
    );

    const result = await transformWithEsbuild(
      configContent,
      absoluteConfigPath,
      {
        loader: 'ts',
        format: 'cjs',
        target: 'esnext',
      }
    );

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
      throw new Error(
        `Failed to load configuration from ${configPath}: ${error.message}`
      );
    }
    throw new Error(`Failed to load configuration from ${configPath}`);
  }
};
