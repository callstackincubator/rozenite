import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

import { pluginSchema } from './site/plugin-schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    // Official plugin docs pages also carry the copy for their page on the site.
    schema: docsSchema({ extend: z.object({ plugin: pluginSchema.optional() }) }),
  }),
};
