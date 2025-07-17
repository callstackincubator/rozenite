import type { PluginInfo } from '../../types.js';
import { step } from '../../utils/steps.js';
import { renderTemplate } from '../../utils/templates.js';
import { TEMPLATE_DIR } from '../../constants.js';

export const bootstrapPlugin = async (
  projectRoot: string,
  pluginInfo: PluginInfo
): Promise<void> => {
  await step(
    {
      start: 'Bootstrapping plugin',
      stop: 'Plugin bootstrapped successfully',
      error: 'Failed to bootstrap plugin',
    },
    async () => {
      await renderTemplate(TEMPLATE_DIR, projectRoot, pluginInfo);
    }
  );
};
