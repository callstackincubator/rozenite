import { withExpoAtlasWithoutExpo } from 'expo-atlas-without-expo';
import { createExpoAtlasMiddleware } from 'expo-atlas/cli';
import connect from 'connect';
import type { ConfigT as MetroConfig } from 'metro-config';

export const withRozeniteExpoAtlasPlugin = async (
  config: MetroConfig | Promise<MetroConfig>
): Promise<MetroConfig> => {
  const metroConfig = await config;
  const withSerializerConfig = withExpoAtlasWithoutExpo(metroConfig);
  const instance = createExpoAtlasMiddleware(withSerializerConfig);

  return withExpoAtlasWithoutExpo({
    ...withSerializerConfig,
    server: {
      ...withSerializerConfig.server,
      enhanceMiddleware: (middleware, server) => {
        const prevMiddleware =
          withSerializerConfig.server?.enhanceMiddleware?.(
            middleware,
            server
          ) ?? middleware;
        return connect()
          .use(prevMiddleware)
          .use('/_expo/atlas', instance.middleware);
      },
    },
  });
};
