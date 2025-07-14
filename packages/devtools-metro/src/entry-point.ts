import crypto from 'node:crypto';
import fs from 'node:fs';
import ejs from 'ejs';
import { TEMPLATE_DIR } from './constants.js';

export const getEntryPointHTML = (installedPlugins: string[]) => {
  const nonce = crypto.randomUUID();
  const template = fs.readFileSync(TEMPLATE_DIR, 'utf8');

  return ejs.render(template, {
    nonce,
    installedPlugins,
  });
};
