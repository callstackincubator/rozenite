import { promptGroup, promptText } from '../../utils/prompts.js';
import validateNpmPackage from 'validate-npm-package-name';
import type { PluginInfo } from '../../types.js';

export const promptForPluginInfo = async (): Promise<PluginInfo> => {
  return await promptGroup({
    name: () =>
      promptText({
        message: 'What is the name of the plugin?',
        validate: (input: string) => {
          if (validateNpmPackage(input).validForNewPackages) {
            return undefined;
          }

          return 'The name must be a valid NPM package name';
        },
      }),
    description: () =>
      promptText({
        message: 'What is the description of the plugin?',
        validate: (input: string) => {
          if (input.length > 0) {
            return undefined;
          }

          return 'The description must be at least 1 character long';
        },
      }),
  });
};
