import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Plugin } from 'vite';

export default function requirePlugin(): Plugin {
  let input = '';
  let inputName = '';
  let isDevMode = false;

  const moduleToChunkMap = new Map<string, string>();

  return {
    name: 'vite-require-plugin',

    configResolved(config) {
      isDevMode = config.command === 'serve';
    },

    transform(code, id) {
      if (!isDevMode || id !== input) {
        return null;
      }

      let transformedCode = code;
      const imports: string[] = [];
      const importMap = new Map<string, string>();

      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

      let match;
      while ((match = requireRegex.exec(code)) !== null) {
        const moduleName = match[1];
        if (moduleName && !importMap.has(moduleName)) {
          const importName = `__import_${importMap.size}`;
          importMap.set(moduleName, importName);
          imports.push(`import * as ${importName} from '${moduleName}';`);
        }
      }

      transformedCode = transformedCode.replace(
        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        (match, moduleName) => {
          const importName = importMap.get(moduleName);
          return importName || match;
        }
      );

      if (imports.length > 0) {
        transformedCode = imports.join('\n') + '\n' + transformedCode;
      }

      return {
        code: transformedCode,
        map: null,
      };
    },

    async buildStart(options) {
      assert(Array.isArray(options.input), 'input must be an array');
      assert(
        options.input.length === 1,
        'input must be an array with one entry'
      );
      input = options.input[0];
      inputName = path.basename(input).replace(/\.[^/.]+$/, '');

      const code = readFileSync(input, 'utf-8');
      const requires = new Set<string>();

      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

      let match;
      while ((match = requireRegex.exec(code)) !== null) {
        const moduleName = match[1];
        if (moduleName) {
          requires.add(moduleName);
        }
      }

      for (const req of requires) {
        const resolved = await this.resolve(req, input);

        if (resolved) {
          const fileName =
            path.basename(resolved.id).replace(/\.[^/.]+$/, '') + '.js';

          this.addWatchFile(resolved.id);
          this.emitFile({
            type: 'chunk',
            id: resolved.id,
            fileName,
          });

          moduleToChunkMap.set(req, fileName);
        }
      }
    },

    renderChunk(code, chunk) {
      if (chunk.name !== inputName) {
        return null;
      }

      let transformedCode = code;

      transformedCode = transformedCode.replace(
        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        (match, moduleName) => {
          const chunkName = moduleToChunkMap.get(moduleName);
          if (chunkName) {
            return `require('./${chunkName}')`;
          }
          return match;
        }
      );

      return {
        code: transformedCode,
        map: null,
      };
    },
  };
}
