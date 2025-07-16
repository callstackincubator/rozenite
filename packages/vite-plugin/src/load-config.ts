import { transformWithEsbuild } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

export type PanelEntry = {
  name: string;
  source: string;
};

export type RozeniteConfig = {
  panels: PanelEntry[];
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
