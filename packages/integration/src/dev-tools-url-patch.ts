import { requireDevMiddlewareInternal, type ProjectResolutionOptions } from './resolve.js';

type GetDevToolsFrontendUrl = (
  experiments: unknown,
  webSocketDebuggerUrl: string,
  devServerUrl: string,
  runtimeOptions: unknown,
) => string;

export const patchDevtoolsFrontendUrl = (options: ProjectResolutionOptions): void => {
  const getDevToolsFrontendUrlModule = requireDevMiddlewareInternal(
    options,
    'utils/getDevToolsFrontendUrl',
  );
  const getDevToolsFrontendUrl = getDevToolsFrontendUrlModule.default as GetDevToolsFrontendUrl;
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
