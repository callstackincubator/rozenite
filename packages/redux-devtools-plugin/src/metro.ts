import type { ConfigT as MetroConfig } from 'metro-config';
import { createMetroConfigTransformer } from '@rozenite/tools';

export const withRozeniteReduxDevTools = createMetroConfigTransformer(
  async (config: MetroConfig): Promise<MetroConfig> => {
    console.warn(
      '[Rozenite, redux-devtools] withRozeniteReduxDevTools() is now a no-op and can be safely removed from Metro config.'
    );

    return config;
  }
);
