import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../../apps/ui-storybook/storybook-static');
const dest = resolve(__dirname, '../build/storybook');

if (!existsSync(src)) {
  throw new Error(
    `Storybook build output not found at ${src}. Run "pnpm --filter ui-storybook build-storybook" first.`,
  );
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
