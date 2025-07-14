import { getGlobalNamespace } from '../global-namespace.js';

export const getPlugins = () => {
  return getGlobalNamespace().installedPlugins;
};
