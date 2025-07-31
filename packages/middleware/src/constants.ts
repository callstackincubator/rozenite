import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPLATE_DIR = path.resolve(
  fileURLToPath(new URL('../templates', import.meta.url)),
  './entry-point.ejs'
);

export const ROZENITE_MANIFEST = 'rozenite.json';
