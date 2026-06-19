import path from 'node:path';
import { normalizePath } from 'vite';

export const ROZENITE_CONFIG_FILE_NAME = 'rozenite.config.ts';
export const ROZENITE_DEV_CONFIG_MODULE_ID = 'virtual:rozenite-dev-config';

const RESOLVED_ROZENITE_DEV_CONFIG_MODULE_ID = `\0${ROZENITE_DEV_CONFIG_MODULE_ID}`;

export const getRozeniteConfigPath = (projectRoot: string) => {
  return path.resolve(projectRoot, ROZENITE_CONFIG_FILE_NAME);
};

export const resolveRozeniteDevConfigModuleId = (id: string) => {
  if (id === ROZENITE_DEV_CONFIG_MODULE_ID) {
    return RESOLVED_ROZENITE_DEV_CONFIG_MODULE_ID;
  }

  return null;
};

export const loadRozeniteDevConfigModule = (id: string, projectRoot: string) => {
  if (id !== RESOLVED_ROZENITE_DEV_CONFIG_MODULE_ID) {
    return null;
  }

  const configPath = normalizePath(getRozeniteConfigPath(projectRoot));

  return `export { default } from ${JSON.stringify(`/@fs${configPath}`)};`;
};
