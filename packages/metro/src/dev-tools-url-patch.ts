import path from 'node:path';

export const patchDevtoolsFrontendUrl = (): void => {
  const getDevToolsFrontendUrlModulePath = path.dirname(
    require.resolve('@react-native/dev-middleware')
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
