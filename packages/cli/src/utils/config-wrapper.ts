import fs from 'node:fs/promises';
import path from 'node:path';

export type BundlerType = 'metro' | 'repack';

const CONFIG_BASE_NAMES = {
  metro: 'metro.config',
  repack: 'rspack.config',
} as const;

const LYNX_CONFIG_BASE_NAME = 'lynx.config';

const MODULE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts'] as const;

const WRAPPER_IMPORTS = {
  metro: {
    packageName: '@rozenite/metro',
    importName: 'withRozenite',
  },
  repack: {
    packageName: '@rozenite/repack',
    importName: 'withRozenite',
  },
} as const;

const LYNX_PLUGIN_IMPORT = {
  packageName: '@rozenite/lynx/rspeedy',
  importName: 'rozeniteLynxPlugin',
} as const;

/**
 * Finds a file with the given base name and any supported module extension
 */
const findFileWithModuleExtension = async (
  projectRoot: string,
  baseName: string,
): Promise<{ filePath: string; extension: string } | null> => {
  for (const extension of MODULE_EXTENSIONS) {
    const filePath = path.join(projectRoot, baseName + extension);
    try {
      await fs.access(filePath);
      return { filePath, extension };
    } catch {
      // File doesn't exist, continue to next extension
    }
  }

  return null;
};

/**
 * Finds the actual config file with any supported extension
 */
const findConfigFile = async (
  projectRoot: string,
  bundlerType: BundlerType,
): Promise<{ filePath: string; extension: string } | null> => {
  return findFileWithModuleExtension(projectRoot, CONFIG_BASE_NAMES[bundlerType]);
};

/**
 * Determines module system based on file extension
 */
const getModuleSystemFromExtension = (extension: string): 'esm' | 'commonjs' | null => {
  switch (extension) {
    case '.mjs':
    case '.mts':
      return 'esm';
    case '.cjs':
    case '.cts':
      return 'commonjs';
    case '.js':
    case '.ts':
      return null; // Need to analyze content
    default:
      return null;
  }
};

/**
 * Helper function to detect quote style used in the code
 */
const detectQuoteStyle = (sourceCode: string): 'single' | 'double' => {
  // Look for imports and requires to determine quote preference
  const singleQuoteMatches = sourceCode.match(/(?:import|require).*'/g) || [];
  const doubleQuoteMatches = sourceCode.match(/(?:import|require).*"/g) || [];

  return doubleQuoteMatches.length > singleQuoteMatches.length ? 'double' : 'single';
};

/**
 * Helper function to determine if code uses ESM or CommonJS style for imports
 * Now prioritizes file extension over content analysis
 */
const determineImportStyle = (sourceCode: string, extension?: string): 'esm' | 'commonjs' => {
  // First check if extension gives us a definitive answer
  if (extension) {
    const extensionBasedStyle = getModuleSystemFromExtension(extension);
    if (extensionBasedStyle) {
      return extensionBasedStyle;
    }
  }

  // Fall back to content analysis for .js and .ts files
  const hasEsmImports = /import\s+.*from\s+['"]/.test(sourceCode);
  const hasCommonJsRequires = /require\s*\(/.test(sourceCode);
  const hasModuleExports = /module\.exports\s*=/.test(sourceCode);

  if (hasEsmImports && hasCommonJsRequires) {
    return 'esm';
  }

  if (hasEsmImports) {
    return 'esm';
  }

  if (hasCommonJsRequires) {
    return 'commonjs';
  }

  if (hasModuleExports) {
    return 'commonjs';
  }

  return 'esm';
};

/**
 * Helper function to find the first import/require line
 */
const findFirstImportLine = (lines: string[]): number => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }

    // Check if this is an import or require line (including multiline starts)
    if (
      line.startsWith('import ') ||
      (line.startsWith('const ') && line.includes('require(')) ||
      (line.startsWith('const{') && line.includes('require('))
    ) {
      return i;
    }

    // If we hit a non-import/require statement, no imports found at the start
    if (line) {
      return -1;
    }
  }

  return -1; // No imports found
};

/**
 * Wraps a bundler configuration file export with withRozenite using smart string manipulation
 * This preserves original formatting while making precise changes
 */
export const wrapConfigFile = async (
  projectRoot: string,
  bundlerType: BundlerType,
): Promise<void> => {
  // Find the actual config file with any supported extension
  const configFileInfo = await findConfigFile(projectRoot, bundlerType);

  if (!configFileInfo) {
    const baseName = CONFIG_BASE_NAMES[bundlerType];
    throw new Error(
      `Configuration file ${baseName}.{${MODULE_EXTENSIONS.join(',')}} not found in ${projectRoot}`,
    );
  }

  const { filePath: configPath, extension } = configFileInfo;

  // Read the config file
  let sourceCode = await fs.readFile(configPath, 'utf8');
  const { packageName, importName } = WRAPPER_IMPORTS[bundlerType];

  // Check if already configured
  const hasEsmImport =
    sourceCode.includes(`from '${packageName}'`) || sourceCode.includes(`from "${packageName}"`);
  const hasCommonJsImport =
    sourceCode.includes(`require('${packageName}')`) ||
    sourceCode.includes(`require("${packageName}")`);
  const hasAnyImport = hasEsmImport || hasCommonJsImport;
  const hasWrapper = sourceCode.includes(`${importName}(`);

  if (hasAnyImport && hasWrapper) {
    // Already configured, nothing to do
    return;
  }

  // Determine module style and quote preference
  const importStyle = determineImportStyle(sourceCode, extension);
  const quoteStyle = detectQuoteStyle(sourceCode);
  const quote = quoteStyle === 'single' ? "'" : '"';

  // Add import if missing
  if (!hasAnyImport) {
    const lines = sourceCode.split('\n');
    const firstImportLine = findFirstImportLine(lines);

    // Create import statement matching the detected style
    const importStatement =
      importStyle === 'esm'
        ? `import { ${importName} } from ${quote}${packageName}${quote};`
        : `const { ${importName} } = require(${quote}${packageName}${quote});`;

    if (firstImportLine >= 0) {
      // Insert before the first import to maintain order
      lines.splice(firstImportLine, 0, importStatement);
    } else {
      // No imports found, add at the beginning (after any leading comments)
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, importStatement);
    }

    sourceCode = lines.join('\n');
  }

  // Wrap the export if not already wrapped
  if (!hasWrapper) {
    // Handle different export patterns using regex with minimal changes

    // Pattern 1: export default { ... }
    const exportDefaultObjectRegex = /(export\s+default\s+)(\{[\s\S]*?\});?\s*$/m;
    const exportDefaultObjectMatch = sourceCode.match(exportDefaultObjectRegex);
    if (exportDefaultObjectMatch) {
      const exportContent = exportDefaultObjectMatch[2];
      sourceCode = sourceCode.replace(
        exportDefaultObjectMatch[0],
        `${exportDefaultObjectMatch[1]}${importName}(${exportContent}, { enabled: process.env.WITH_ROZENITE === 'true' });`,
      );
    } else {
      // Pattern 2: export default someFunction()
      const exportDefaultCallRegex = /(export\s+default\s+)([^;]+);?\s*$/m;
      const exportDefaultCallMatch = sourceCode.match(exportDefaultCallRegex);
      if (exportDefaultCallMatch) {
        const exportContent = exportDefaultCallMatch[2];
        sourceCode = sourceCode.replace(
          exportDefaultCallMatch[0],
          `${exportDefaultCallMatch[1]}${importName}(${exportContent}, { enabled: process.env.WITH_ROZENITE === 'true' });`,
        );
      } else {
        // Pattern 3: module.exports = { ... }
        const moduleExportsObjectRegex = /(module\.exports\s*=\s*)(\{[\s\S]*?\});?\s*$/m;
        const moduleExportsObjectMatch = sourceCode.match(moduleExportsObjectRegex);
        if (moduleExportsObjectMatch) {
          const exportContent = moduleExportsObjectMatch[2];
          sourceCode = sourceCode.replace(
            moduleExportsObjectMatch[0],
            `${moduleExportsObjectMatch[1]}${importName}(${exportContent}, { enabled: process.env.WITH_ROZENITE === 'true' });`,
          );
        } else {
          // Pattern 4: module.exports = someFunction()
          const moduleExportsCallRegex = /(module\.exports\s*=\s*)([^;]+);?\s*$/m;
          const moduleExportsCallMatch = sourceCode.match(moduleExportsCallRegex);
          if (moduleExportsCallMatch) {
            const exportContent = moduleExportsCallMatch[2];
            sourceCode = sourceCode.replace(
              moduleExportsCallMatch[0],
              `${moduleExportsCallMatch[1]}${importName}(${exportContent}, { enabled: process.env.WITH_ROZENITE === 'true' });`,
            );
          }
        }
      }
    }
  }

  // Write back to file
  await fs.writeFile(configPath, sourceCode, 'utf8');
};

/**
 * Gets the expected configuration file path for a bundler type
 * Returns the first found config file or the default .js version if none exist
 */
export const getConfigFilePath = async (
  projectRoot: string,
  bundlerType: BundlerType,
): Promise<string> => {
  const configFileInfo = await findConfigFile(projectRoot, bundlerType);

  if (configFileInfo) {
    return configFileInfo.filePath;
  }

  // If no config file found, return default .js path
  const baseName = CONFIG_BASE_NAMES[bundlerType];
  return path.join(projectRoot, baseName + '.js');
};

/**
 * Replaces the contents of every template literal (`` `...` ``, including
 * its `${...}` interpolations), line comment, and block comment with spaces
 * (newlines preserved), leaving every other character — including plain
 * `'...'`/`"..."` string literals — untouched. Used so structural scanning
 * (finding the `plugins` property, matching `[`/`]` pairs) never mistakes a
 * bracket that only appears inside a template literal or a comment for
 * real code — the case that actually bites in practice, since rspeedy
 * plugin options (`schema(url) { return \`${url}?x=...\` }`, etc.) commonly
 * hold template literals but rarely hold plain quoted strings shaped like
 * code. Plain strings are deliberately left alone: the import-detection
 * checks in `wrapLynxConfigFile` need the literal package name inside
 * `from '<package>'` to still be there. The result is the same length as
 * `sourceCode`, so any index found in it is a valid index into the
 * original source.
 */
const maskStringsAndComments = (sourceCode: string): string => {
  let result = '';
  let i = 0;
  const n = sourceCode.length;

  const maskUntil = (predicate: (index: number) => boolean): void => {
    while (i < n && !predicate(i)) {
      if (sourceCode[i] === '\\' && i + 1 < n) {
        result += sourceCode[i] === '\n' ? '\n' : ' ';
        result += sourceCode[i + 1] === '\n' ? '\n' : ' ';
        i += 2;
        continue;
      }
      result += sourceCode[i] === '\n' ? '\n' : ' ';
      i += 1;
    }
  };

  while (i < n) {
    const char = sourceCode[i];
    const next = sourceCode[i + 1];

    if (char === '/' && next === '/') {
      result += '  ';
      i += 2;
      maskUntil((index) => sourceCode[index] === '\n');
      continue;
    }

    if (char === '/' && next === '*') {
      result += '  ';
      i += 2;
      maskUntil((index) => sourceCode[index] === '*' && sourceCode[index + 1] === '/');
      if (i < n) {
        result += '  ';
        i += 2;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      // Plain string literals are left completely untouched -- see the
      // doc comment above for why.
      const quote = char;
      result += quote;
      i += 1;
      while (i < n && sourceCode[i] !== quote) {
        if (sourceCode[i] === '\\' && i + 1 < n) {
          result += sourceCode[i] + sourceCode[i + 1];
          i += 2;
          continue;
        }
        result += sourceCode[i];
        i += 1;
      }
      if (i < n) {
        result += quote;
        i += 1;
      }
      continue;
    }

    if (char === '`') {
      result += ' ';
      i += 1;
      maskUntil((index) => sourceCode[index] === '`');
      if (i < n) {
        result += ' ';
        i += 1;
      }
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
};

/** Number of unclosed `{` characters in `source` before `index`. */
const braceDepthAt = (source: string, index: number): number => {
  let depth = 0;

  for (let i = 0; i < index; i++) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
    }
  }

  return depth;
};

/**
 * Finds the `plugins: [...]` array in an rspeedy config's source and returns
 * the index just before its closing bracket, respecting nested `[`/`]`
 * pairs inside plugin call arguments (e.g. `pluginFoo({ include: [...] })`).
 * `maskedSourceCode` must be `sourceCode` (same length) run through
 * `maskStringsAndComments`, so a `plugins:`-shaped string inside a string or
 * comment is never mistaken for the real property, and so a candidate that
 * is itself nested inside another object (e.g. `tools: { rspack: { plugins:
 * [] } }`) is skipped in favor of one that is a direct property of the
 * top-level config object. Returns -1 when no top-level `plugins` array is
 * found.
 */
const findPluginsArrayInsertionPoint = (maskedSourceCode: string): number => {
  const pattern = /plugins\s*:\s*\[/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(maskedSourceCode)) !== null) {
    if (braceDepthAt(maskedSourceCode, match.index) !== 1) {
      // A `plugins` array nested inside some other property's object
      // literal (or one preceding the actual config object entirely) --
      // keep looking for one directly on the top-level config object.
      continue;
    }

    let depth = 1;
    let index = match.index + match[0].length;

    while (index < maskedSourceCode.length && depth > 0) {
      const char = maskedSourceCode[index];

      if (char === '[') {
        depth += 1;
      } else if (char === ']') {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }

      index += 1;
    }

    return -1;
  }

  return -1;
};

/**
 * Inserts `<importName>(),` as a new array element right before the
 * `plugins` array's closing bracket at `insertionPoint`, matching the
 * indentation of the array's other elements when the array spans multiple
 * lines, or inserting inline otherwise. Adds a separating comma after the
 * previous element when the array doesn't already end in one, so appending
 * to `[pluginFoo()]` (no trailing comma) or a multiline array whose last
 * element omits one doesn't produce `pluginFoo() rozeniteLynxPlugin()` --
 * two expressions with nothing between them, which is a syntax error.
 */
const insertPluginCall = (
  sourceCode: string,
  insertionPoint: number,
  importName: string,
): string => {
  const beforeClosing = sourceCode.slice(0, insertionPoint);
  const afterClosing = sourceCode.slice(insertionPoint);

  const linesBefore = beforeClosing.split('\n');
  const closingLinePrefix = linesBefore[linesBefore.length - 1];
  const isMultiline = linesBefore.length > 1 && closingLinePrefix.trim() === '';

  if (!isMultiline) {
    const arrayStart = beforeClosing.lastIndexOf('[');
    const arrayContent = beforeClosing.slice(arrayStart + 1);
    const trimmedContent = arrayContent.replace(/\s+$/, '');
    const hasExistingElements = trimmedContent.length > 0;
    const needsComma = hasExistingElements && !trimmedContent.endsWith(',');
    const separator = !hasExistingElements ? '' : needsComma ? ', ' : ' ';

    return `${beforeClosing}${separator}${importName}(),${afterClosing}`;
  }

  const previousLineIndex = linesBefore.length - 2;
  const previousLine = linesBefore[previousLineIndex] ?? '';
  const trimmedPrevious = previousLine.replace(/\s+$/, '');
  const previousIsElement = trimmedPrevious.length > 0 && !trimmedPrevious.endsWith('[');
  const needsComma = previousIsElement && !trimmedPrevious.endsWith(',');
  const itemIndent = previousIsElement
    ? (trimmedPrevious.match(/^\s*/)?.[0] ?? `${closingLinePrefix}  `)
    : `${closingLinePrefix}  `;

  const patchedLines = linesBefore.slice(0, -1);
  if (needsComma) {
    patchedLines[previousLineIndex] = `${trimmedPrevious},`;
  }

  const newBeforeClosing = `${patchedLines.join('\n')}\n${itemIndent}${importName}(),\n${closingLinePrefix}`;

  return newBeforeClosing + afterClosing;
};

/**
 * Wraps an rspeedy (`lynx.config.*`) configuration file by adding
 * `rozeniteLynxPlugin()` to its `plugins` array, using the same
 * string-manipulation approach as `wrapConfigFile` so original formatting
 * is preserved.
 */
export const wrapLynxConfigFile = async (projectRoot: string): Promise<void> => {
  const configFileInfo = await findFileWithModuleExtension(projectRoot, LYNX_CONFIG_BASE_NAME);

  if (!configFileInfo) {
    throw new Error(
      `Configuration file ${LYNX_CONFIG_BASE_NAME}.{${MODULE_EXTENSIONS.join(',')}} not found in ${projectRoot}`,
    );
  }

  const { filePath: configPath, extension } = configFileInfo;

  let sourceCode = await fs.readFile(configPath, 'utf8');
  const { packageName, importName } = LYNX_PLUGIN_IMPORT;

  // Checked against the masked source throughout this function so a mention
  // of the package name or the plugin call inside a comment or string never
  // counts as "already configured".
  let masked = maskStringsAndComments(sourceCode);

  const hasEsmImport =
    masked.includes(`from '${packageName}'`) || masked.includes(`from "${packageName}"`);
  const hasCommonJsImport =
    masked.includes(`require('${packageName}')`) || masked.includes(`require("${packageName}")`);
  const hasAnyImport = hasEsmImport || hasCommonJsImport;
  const hasUsage = masked.includes(`${importName}(`);

  if (hasAnyImport && hasUsage) {
    // Already configured, nothing to do
    return;
  }

  const importStyle = determineImportStyle(sourceCode, extension);
  const quoteStyle = detectQuoteStyle(sourceCode);
  const quote = quoteStyle === 'single' ? "'" : '"';

  if (!hasAnyImport) {
    const lines = sourceCode.split('\n');
    const firstImportLine = findFirstImportLine(lines);

    const importStatement =
      importStyle === 'esm'
        ? `import { ${importName} } from ${quote}${packageName}${quote};`
        : `const { ${importName} } = require(${quote}${packageName}${quote});`;

    if (firstImportLine >= 0) {
      lines.splice(firstImportLine, 0, importStatement);
    } else {
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
          insertIndex = i;
          break;
        }
      }
      lines.splice(insertIndex, 0, importStatement);
    }

    sourceCode = lines.join('\n');
    // The import line just inserted shifts every subsequent index, so the
    // mask used below has to be recomputed against the updated source.
    masked = maskStringsAndComments(sourceCode);
  }

  if (!hasUsage) {
    const insertionPoint = findPluginsArrayInsertionPoint(masked);

    if (insertionPoint === -1) {
      throw new Error(
        `Could not find a "plugins" array in ${configPath}. Add ${importName}() to it manually.`,
      );
    }

    sourceCode = insertPluginCall(sourceCode, insertionPoint, importName);
  }

  await fs.writeFile(configPath, sourceCode, 'utf8');
};

/**
 * Gets the expected `lynx.config.*` file path.
 * Returns the first found config file or the default `.ts` version if none
 * exist.
 */
export const getLynxConfigFilePath = async (projectRoot: string): Promise<string> => {
  const configFileInfo = await findFileWithModuleExtension(projectRoot, LYNX_CONFIG_BASE_NAME);

  if (configFileInfo) {
    return configFileInfo.filePath;
  }

  return path.join(projectRoot, LYNX_CONFIG_BASE_NAME + '.ts');
};
