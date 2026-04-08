import path from 'node:path';
import { createRequire } from 'node:module';
import { getDevMiddlewarePath } from './resolve.js';
import { RozeniteConfig } from './index.js';

const require = createRequire(import.meta.url);

export const patchDevtoolsFrontendUrl = (options: RozeniteConfig): void => {
  const getDevToolsFrontendUrlModulePath = path.dirname(
    getDevMiddlewarePath(options),
  );
  const getDevToolsFrontendUrlModule = require(
    path.join(
      getDevToolsFrontendUrlModulePath,
      '/utils/getDevToolsFrontendUrl',
    ),
  );
  const getDevToolsFrontendUrl = getDevToolsFrontendUrlModule.default;
  getDevToolsFrontendUrlModule.default = (
    experiments: unknown,
    webSocketDebuggerUrl: string,
    devServerUrl: string,
    runtimeOptions: unknown,
  ) => {
    const originalUrl = getDevToolsFrontendUrl(
      experiments,
      webSocketDebuggerUrl,
      devServerUrl,
      runtimeOptions,
    );
    return originalUrl.replace('/debugger-frontend/', '/rozenite/');
  };
};
