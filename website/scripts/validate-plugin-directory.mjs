// Validates ../plugin-directory.json with the same code the site build uses. Offline: it checks
// the entries, not npm or GitHub. Runs in CI, where a pull request that only edits the file
// builds no package. Importing a .ts file relies on Node's native type stripping (Node 22.18+),
// so utils.ts must keep to erasable TypeScript syntax.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validatePluginReferences } from '../src/plugin-directory/utils.ts';

const file =
  process.argv[2] ?? fileURLToPath(new URL('../../plugin-directory.json', import.meta.url));

try {
  const entries = validatePluginReferences(JSON.parse(readFileSync(file, 'utf8')));
  console.log(`plugin-directory.json: ${entries.length} entries are valid.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
