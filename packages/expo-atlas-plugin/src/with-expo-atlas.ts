import { createExpoAtlasMiddleware } from 'expo-atlas/cli';
import connect from 'connect';
import type { ConfigT as MetroConfig } from 'metro-config';
import { getBaseSerializer } from './base-serializer';

export const withRozeniteExpoAtlasPlugin = async (
  config: MetroConfig | Promise<MetroConfig>
): Promise<MetroConfig> => {
  const metroConfig = await config;

  const basicConfig = {
    ...metroConfig,
    serializer: {
      ...metroConfig.serializer,
      customSerializer:
        metroConfig?.serializer?.customSerializer ?? getBaseSerializer(),
    },
  };
  const instance = createExpoAtlasMiddleware(basicConfig);

  return {
    ...basicConfig,
    server: {
      ...basicConfig.server,
      enhanceMiddleware: (middleware, server) => {
        const prevMiddleware =
          basicConfig.server?.enhanceMiddleware?.(middleware, server) ??
          middleware;

        return connect()
          .use(prevMiddleware)
          .use('/_expo/atlas', instance.middleware);
      },
    },
  };
};
