import { createExpoAtlasMiddleware } from 'expo-atlas/cli';
import connect from 'connect';
import type { ConfigT as MetroConfig } from 'metro-config';
import { createMetroConfigTransformer } from '@rozenite/tools';
import { getBaseSerializer } from './base-serializer';

export const withRozeniteExpoAtlasPlugin = createMetroConfigTransformer(
  async (config: MetroConfig): Promise<MetroConfig> => {
    const basicConfig = {
      ...config,
      serializer: {
        ...config.serializer,
        customSerializer:
          config?.serializer?.customSerializer ?? getBaseSerializer(),
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
  },
);
