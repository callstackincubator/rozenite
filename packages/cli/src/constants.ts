import { fileURLToPath } from 'node:url';

export const TEMPLATE_DIR = fileURLToPath(new URL('../template', import.meta.url));

export const DOCS_DIR = fileURLToPath(new URL('../docs', import.meta.url));
