import path from 'node:path';
import { createRequire } from 'node:module';
import { getDevMiddlewarePath } from './resolve.js';

const require = createRequire(import.meta.url);

export const patchDevtoolsFrontendUrl = (projectRoot: string): void => {
  const getDevToolsFrontendUrlModulePath = path.dirname(
    getDevMiddlewarePath(projectRoot)
  );
  const getDevToolsFrontendUrlModule = require(path.join(
    getDevToolsFrontendUrlModulePath,
    '/utils/getDevToolsFrontendUrl'
  ));
  const getDevToolsFrontendUrl = getDevToolsFrontendUrlModule.default;
  getDevToolsFrontendUrlModule.default = (
    experiments: unknown,
    webSocketDebuggerUrl: string,
    devServerUrl: string,
    options: unknown
  ) => {
    const originalUrl = getDevToolsFrontendUrl(
      experiments,
      webSocketDebuggerUrl,
      devServerUrl,
      options
    );
    return originalUrl.replace('/debugger-frontend/', '/rozenite/');
  };
};
