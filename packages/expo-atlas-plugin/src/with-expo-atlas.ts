import { createExpoAtlasMiddleware } from 'expo-atlas/cli';
import connect from 'connect';
import { createMetroConfigTransformer } from '@rozenite/tools';
import { getBaseSerializer } from './base-serializer';

export const withRozeniteExpoAtlasPlugin = createMetroConfigTransformer(
  async (config) => {
    const basicConfig = {
      ...config,
      serializer: {
        ...config.serializer,
        customSerializer:
          config?.serializer?.customSerializer ?? getBaseSerializer(),
      },
    };
    const instance = createExpoAtlasMiddleware(
      basicConfig as unknown as Parameters<typeof createExpoAtlasMiddleware>[0]
    );

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
