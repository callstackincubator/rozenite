import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Plugin } from 'vite';

const REQUIRE_REGEX = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const IMPORT_PREFIX = '__import_';

interface ModuleInfo {
  referenceId: string;
}

interface TransformResult {
  code: string;
  imports: string[];
  importMap: Map<string, string>;
}

export default function requirePlugin(): Plugin {
  let input = '';
  let inputName = '';
  let isDevMode = false;

  const moduleInfoMap = new Map<string, ModuleInfo>();

  const extractModuleName = (filePath: string): string => {
    return path.basename(filePath).replace(/\.[^/.]+$/, '');
  };

  const findRequireStatements = (code: string): Set<string> => {
    const requires = new Set<string>();
    let match: RegExpExecArray | null;

    // Reset regex state
    REQUIRE_REGEX.lastIndex = 0;

    while ((match = REQUIRE_REGEX.exec(code)) !== null) {
      const moduleName = match[1];
      if (moduleName && moduleName.trim()) {
        requires.add(moduleName.trim());
      }
    }

    return requires;
  };

  const transformRequireToImports = (code: string): TransformResult => {
    const imports: string[] = [];
    const importMap = new Map<string, string>();

    // Find all require statements
    const requires = findRequireStatements(code);

    // Create import statements
    requires.forEach((moduleName, index) => {
      const importName = `${IMPORT_PREFIX}${index}`;
      importMap.set(moduleName, importName);
      imports.push(`import * as ${importName} from '${moduleName}';`);
    });

    // Replace require statements with import references
    let transformedCode = code.replace(REQUIRE_REGEX, (match, moduleName) => {
      const importName = importMap.get(moduleName.trim());
      return importName || match;
    });

    // Prepend imports if any exist
    if (imports.length > 0) {
      transformedCode = imports.join('\n') + '\n' + transformedCode;
    }

    return { code: transformedCode, imports, importMap };
  };

  const transformRequireToChunkReferences = (
    code: string,
    getFileName: (referenceId: string) => string,
  ): string => {
    return code.replace(REQUIRE_REGEX, (match, moduleName) => {
      const moduleInfo = moduleInfoMap.get(moduleName.trim());
      if (!moduleInfo) return match;

      const outFileName = getFileName(moduleInfo.referenceId);
      const relPath = outFileName.startsWith('.')
        ? outFileName
        : `./${outFileName}`;
      return `require('${relPath}')`;
    });
  };

  return {
    name: 'vite-require-plugin',

    configResolved(config) {
      isDevMode = config.command === 'serve';
    },

    transform(code, id) {
      // Only transform in dev mode and for the main input file
      if (!isDevMode || id !== input) {
        return null;
      }

      try {
        const result = transformRequireToImports(code);

        return {
          code: result.code,
          map: null,
        };
      } catch (error) {
        console.error('Error transforming require statements:', error);
        return null;
      }
    },

    async buildStart(options) {
      try {
        // Validate input configuration
        assert(Array.isArray(options.input), 'input must be an array');
        assert(
          options.input.length === 1,
          'input must be an array with one entry'
        );

        input = options.input[0];
        inputName = extractModuleName(input);

        // Read and parse the input file
        const code = readFileSync(input, 'utf-8');
        const requires = findRequireStatements(code);

        // Process each require statement
        for (const req of requires) {
          try {
            const resolved = await this.resolve(req, input);

            if (resolved) {
              // Add to watch files for hot reload
              this.addWatchFile(resolved.id);

              // Emit as separate chunk
              const referenceId = this.emitFile({
                type: 'chunk',
                id: resolved.id,
                name: extractModuleName(resolved.id),
              });

              // Store mappings
              moduleInfoMap.set(req, {
                referenceId,
              });
            } else {
              console.warn(`Could not resolve module: ${req}`);
            }
          } catch (error) {
            console.error(`Error resolving module ${req}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in buildStart:', error);
        throw error;
      }
    },

    renderChunk(code, chunk) {
      try {
        // Only transform the main input chunk
        if (chunk.name !== inputName) {
          return null;
        }

        const transformedCode = transformRequireToChunkReferences(
          code,
          (referenceId) => this.getFileName(referenceId),
        );

        return {
          code: transformedCode,
          map: null,
        };
      } catch (error) {
        console.error('Error in renderChunk:', error);
        return null;
      }
    },
  };
}
