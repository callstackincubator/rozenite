import ejs from 'ejs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginInfo } from '../types.js';

const renderTemplateFile = async (
  src: string,
  dest: string,
  pluginInfo: PluginInfo
): Promise<void> => {
  let content = await fs.readFile(src, 'utf8');
  content = ejs.render(content, pluginInfo);

  let basename = path.basename(dest);
  basename = ejs.render(basename.replace(/^\$/, ''), pluginInfo, {
    openDelimiter: '{',
    closeDelimiter: '}',
    escape: (value: string) => value.replace(/\./g, path.sep),
  });
  const targetFilePath = path.join(path.dirname(dest), basename);

  const targetDir = path.dirname(targetFilePath);
  await fs.mkdir(targetDir, { recursive: true });

  await fs.writeFile(targetFilePath, content, 'utf8');
  const { mode } = await fs.stat(src);
  await fs.chmod(targetFilePath, mode);
};

export const renderTemplate = async (
  src: string,
  dest: string,
  pluginInfo: PluginInfo
): Promise<void> => {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await renderTemplate(srcPath, dstPath, pluginInfo);
    } else {
      await renderTemplateFile(srcPath, dstPath, pluginInfo);
    }
  }
};
