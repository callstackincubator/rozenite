import assert from 'node:assert';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { normalizePath, Plugin } from 'vite';

const REQUIRE_REGEX = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const IMPORT_PREFIX = '__import_';
const VIRTUAL_REQUIRE_PREFIX = '\0virtual:rozenite-rn-require:';
const REQUIRE_WRAPPER_SUFFIX = '.require';

interface ModuleInfo {
  referenceId: string;
  virtualId: string;
}

interface TransformResult {
  code: string;
}

const extractModuleName = (filePath: string): string => {
  return path.basename(filePath).replace(/\.[^/.]+$/, '');
};

const sanitizeChunkName = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
};

const findRequireStatements = (code: string): Set<string> => {
  const requires = new Set<string>();
  let match: RegExpExecArray | null;

  REQUIRE_REGEX.lastIndex = 0;

  while ((match = REQUIRE_REGEX.exec(code)) !== null) {
    const moduleName = match[1];
    if (moduleName && moduleName.trim()) {
      requires.add(moduleName.trim());
    }
  }

  return requires;
};

const transformRequireToImports = (
  code: string,
  moduleInfoMap: Map<string, ModuleInfo>,
): TransformResult => {
  const imports: string[] = [];
  const importMap = new Map<string, string>();
  const requires = findRequireStatements(code);

  requires.forEach((moduleName, index) => {
    const moduleInfo = moduleInfoMap.get(moduleName);

    if (!moduleInfo) {
      return;
    }

    const importName = `${IMPORT_PREFIX}${index}`;
    importMap.set(moduleName, importName);
    imports.push(`import * as ${importName} from '${moduleInfo.virtualId}';`);
  });

  let transformedCode = code.replace(REQUIRE_REGEX, (match, moduleName) => {
    const importName = importMap.get(moduleName.trim());
    return importName || match;
  });

  if (imports.length > 0) {
    transformedCode = imports.join('\n') + '\n' + transformedCode;
  }

  return { code: transformedCode };
};

const transformRequireToChunkReferences = (
  code: string,
  moduleInfoMap: Map<string, ModuleInfo>,
  getFileName: (referenceId: string) => string,
): string => {
  return code.replace(REQUIRE_REGEX, (match, moduleName) => {
    const moduleInfo = moduleInfoMap.get(moduleName.trim());

    if (!moduleInfo) {
      return match;
    }

    const outFileName = getFileName(moduleInfo.referenceId);
    const relPath = normalizePath(
      path.posix.relative('react-native', outFileName),
    );
    const requirePath = relPath.startsWith('.') ? relPath : `./${relPath}`;

    return `require('${requirePath}')`;
  });
};

export default function requirePlugin(): Plugin {
  let input = '';
  let inputName = '';
  let isDevMode = false;

  const moduleInfoMap = new Map<string, ModuleInfo>();
  const virtualModuleSources = new Map<string, string>();

  return {
    name: 'vite-require-plugin',

    configResolved(config) {
      isDevMode = config.command === 'serve';
    },

    resolveId(id) {
      if (virtualModuleSources.has(id)) {
        return id;
      }

      return null;
    },

    load(id) {
      return virtualModuleSources.get(id) ?? null;
    },

    transform(code, id) {
      if (!isDevMode || id !== input) {
        return null;
      }

      try {
        const result = transformRequireToImports(code, moduleInfoMap);

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
        assert(Array.isArray(options.input), 'input must be an array');
        assert(
          options.input.length === 1,
          'input must be an array with one entry',
        );

        input = options.input[0];
        inputName = extractModuleName(input);
        moduleInfoMap.clear();
        virtualModuleSources.clear();

        const code = readFileSync(input, 'utf-8');
        const requires = findRequireStatements(code);

        for (const req of requires) {
          try {
            const resolved = await this.resolve(req, input, { skipSelf: true });

            if (!resolved) {
              console.warn(`Could not resolve module: ${req}`);
              continue;
            }

            this.addWatchFile(resolved.id);

            const exportName = sanitizeChunkName(
              extractModuleName(resolved.id),
            );
            const wrapperName = `${exportName}${REQUIRE_WRAPPER_SUFFIX}`;
            const virtualId = `${VIRTUAL_REQUIRE_PREFIX}${wrapperName}`;

            virtualModuleSources.set(
              virtualId,
              `export * from ${JSON.stringify(req)};`,
            );

            const referenceId = this.emitFile({
              type: 'chunk',
              id: virtualId,
              name: wrapperName,
            });

            moduleInfoMap.set(req, {
              referenceId,
              virtualId,
            });
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
        if (chunk.name !== inputName) {
          return null;
        }

        return {
          code: transformRequireToChunkReferences(
            code,
            moduleInfoMap,
            (referenceId) => normalizePath(this.getFileName(referenceId)),
          ),
          map: null,
        };
      } catch (error) {
        console.error('Error in renderChunk:', error);
        return null;
      }
    },
  };
}
