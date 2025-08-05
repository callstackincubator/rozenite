import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const getReactNativePackagePath = (projectRoot: string): string => {
  const input = require.resolve('react-native', { paths: [projectRoot] });
  return path.dirname(input);
};

export const getDevMiddlewarePath = (projectRoot: string): string => {
  const reactNativeCommunityCliPluginPath = require.resolve(
    '@react-native/community-cli-plugin',
    { paths: [getReactNativePackagePath(projectRoot)] }
  );

  return require.resolve('@react-native/dev-middleware', {
    paths: [reactNativeCommunityCliPluginPath],
  });
};
