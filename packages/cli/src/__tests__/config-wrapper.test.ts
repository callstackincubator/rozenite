import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { wrapConfigFile, type BundlerType } from '../utils/config-wrapper.js';

// Test fixtures for different config file patterns
const FIXTURES = {
  metro: {
    commonjs: {
      // Basic CommonJS module.exports object
      basic: `module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`,
      // CommonJS with function call
      functionCall: `const { getDefaultConfig } = require('react-native/metro-config');

module.exports = getDefaultConfig(__dirname);`,
      // CommonJS with complex object
      complex: `const path = require('path');

module.exports = {
  projectRoot: path.resolve(__dirname, '../../'),
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
  ],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
};`,
      // Already wrapped CommonJS
      alreadyWrapped: `const { withRozenite } = require('@rozenite/metro');

module.exports = withRozenite({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
});`,
    },
    esm: {
      // Basic ESM export default object
      basic: `export default {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`,
      // ESM with function call
      functionCall: `import { getDefaultConfig } from 'react-native/metro-config';

export default getDefaultConfig(__dirname);`,
      // ESM with import and complex object
      complex: `import path from 'path';

export default {
  projectRoot: path.resolve(process.cwd(), '../../'),
  watchFolders: [
    path.resolve(process.cwd(), '../../node_modules'),
  ],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
};`,
      // Already wrapped ESM
      alreadyWrapped: `import { withRozenite } from '@rozenite/metro';

export default withRozenite({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
});`,
    },
  },
  repack: {
    commonjs: {
      // Basic CommonJS module.exports object
      basic: `module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: __dirname + '/dist',
  },
};`,
      // CommonJS with function call
      functionCall: `const { getDefaultConfig } = require('@repack/config');

module.exports = getDefaultConfig(__dirname);`,
      // Already wrapped CommonJS
      alreadyWrapped: `const { withRozenite } = require('@rozenite/repack');

module.exports = withRozenite({
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: __dirname + '/dist',
  },
});`,
    },
    esm: {
      // Basic ESM export default object
      basic: `export default {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: process.cwd() + '/dist',
  },
};`,
      // ESM with function call
      functionCall: `import { getDefaultConfig } from '@repack/config';

export default getDefaultConfig(process.cwd());`,
      // Already wrapped ESM
      alreadyWrapped: `import { withRozenite } from '@rozenite/repack';

export default withRozenite({
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: process.cwd() + '/dist',
  },
});`,
    },
  },
};

describe('wrapConfigFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-wrapper-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Helper function to create a config file with given content
  const createConfigFile = async (
    bundlerType: BundlerType,
    content: string,
    extension = '.js'
  ) => {
    const baseName = bundlerType === 'metro' ? 'metro.config' : 'rspack.config';
    const filename = baseName + extension;
    const configPath = path.join(tempDir, filename);
    await fs.writeFile(configPath, content, 'utf8');
    return configPath;
  };

  // Helper function to validate JavaScript/TypeScript syntax
  const validateJavaScript = (code: string): boolean => {
    try {
      // Basic syntax validation - check for balanced braces, semicolons, etc.

      // Count braces
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) return false;

      // Count parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) return false;

      // Check for basic export patterns
      const hasValidExport =
        /export\s+default\s+/.test(code) || /module\.exports\s*=/.test(code);
      if (!hasValidExport) return false;

      // Check for proper import/require syntax
      const importMatches =
        code.match(/import\s+.*from\s+['"][^'"]+['"]/g) || [];

      // Validate import statements
      for (const importMatch of importMatches) {
        if (!importMatch.includes('from')) return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  describe('metro', () => {
    describe('CommonJS', () => {
      it('should wrap basic CommonJS config file', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.commonjs.basic
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        // Should have CommonJS require statement for CommonJS config
        expect(wrappedContent).toContain(
          "const { withRozenite } = require('@rozenite/metro');"
        );
        // Should wrap the export
        expect(wrappedContent).toContain('withRozenite({');
        // Should be valid JavaScript
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap CommonJS config with function call', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.commonjs.functionCall
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "const { withRozenite } = require('@rozenite/metro');"
        );
        expect(wrappedContent).toContain(
          'withRozenite(getDefaultConfig(__dirname))'
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap complex CommonJS config', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.commonjs.complex
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "const { withRozenite } = require('@rozenite/metro');"
        );
        expect(wrappedContent).toContain('withRozenite({');
        expect(wrappedContent).toContain('projectRoot:');
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should not modify already wrapped CommonJS config', async () => {
        const originalContent = FIXTURES.metro.commonjs.alreadyWrapped;
        const configPath = await createConfigFile('metro', originalContent);

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        // Should remain unchanged since it's already properly wrapped
        expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
          originalContent.replace(/\s+/g, ' ')
        );

        expect(validateJavaScript(wrappedContent)).toBe(true);
      });
    });

    describe('ESM', () => {
      it('should wrap basic ESM config file', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.esm.basic
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "import { withRozenite } from '@rozenite/metro';"
        );
        expect(wrappedContent).toContain('export default withRozenite({');
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap ESM config with function call', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.esm.functionCall
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "import { withRozenite } from '@rozenite/metro';"
        );
        expect(wrappedContent).toContain(
          'export default withRozenite(getDefaultConfig(__dirname))'
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap complex ESM config', async () => {
        const configPath = await createConfigFile(
          'metro',
          FIXTURES.metro.esm.complex
        );

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "import { withRozenite } from '@rozenite/metro';"
        );
        expect(wrappedContent).toContain('export default withRozenite({');
        expect(wrappedContent).toContain('projectRoot:');
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should not modify already wrapped ESM config', async () => {
        const originalContent = FIXTURES.metro.esm.alreadyWrapped;
        const configPath = await createConfigFile('metro', originalContent);

        await wrapConfigFile(tempDir, 'metro');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
          originalContent.replace(/\s+/g, ' ')
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });
    });
  });

  describe('repack', () => {
    describe('CommonJS', () => {
      it('should wrap basic CommonJS config file', async () => {
        const configPath = await createConfigFile(
          'repack',
          FIXTURES.repack.commonjs.basic
        );

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "const { withRozenite } = require('@rozenite/repack');"
        );
        expect(wrappedContent).toContain('withRozenite({');
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap CommonJS config with function call', async () => {
        const configPath = await createConfigFile(
          'repack',
          FIXTURES.repack.commonjs.functionCall
        );

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "const { withRozenite } = require('@rozenite/repack');"
        );
        expect(wrappedContent).toContain(
          'withRozenite(getDefaultConfig(__dirname))'
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should not modify already wrapped CommonJS config', async () => {
        const originalContent = FIXTURES.repack.commonjs.alreadyWrapped;
        const configPath = await createConfigFile('repack', originalContent);

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        // Should remain unchanged since it's already properly wrapped
        expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
          originalContent.replace(/\s+/g, ' ')
        );

        expect(validateJavaScript(wrappedContent)).toBe(true);
      });
    });

    describe('ESM', () => {
      it('should wrap basic ESM config file', async () => {
        const configPath = await createConfigFile(
          'repack',
          FIXTURES.repack.esm.basic
        );

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "import { withRozenite } from '@rozenite/repack';"
        );
        expect(wrappedContent).toContain('export default withRozenite({');
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should wrap ESM config with function call', async () => {
        const configPath = await createConfigFile(
          'repack',
          FIXTURES.repack.esm.functionCall
        );

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent).toContain(
          "import { withRozenite } from '@rozenite/repack';"
        );
        expect(wrappedContent).toContain(
          'export default withRozenite(getDefaultConfig(process.cwd()))'
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });

      it('should not modify already wrapped ESM config', async () => {
        const originalContent = FIXTURES.repack.esm.alreadyWrapped;
        const configPath = await createConfigFile('repack', originalContent);

        await wrapConfigFile(tempDir, 'repack');

        const wrappedContent = await fs.readFile(configPath, 'utf8');

        expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
          originalContent.replace(/\s+/g, ' ')
        );
        expect(validateJavaScript(wrappedContent)).toBe(true);
      });
    });
  });

  describe('import style detection', () => {
    it('should use CommonJS style for CommonJS configs', async () => {
      const configPath = await createConfigFile(
        'metro',
        FIXTURES.metro.commonjs.basic
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use CommonJS require syntax, not ESM import
      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).not.toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should use ESM style for ESM configs', async () => {
      const configPath = await createConfigFile(
        'metro',
        FIXTURES.metro.esm.basic
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use ESM import syntax, not CommonJS require
      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).not.toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should use CommonJS style when config has existing require statements', async () => {
      const configWithRequire = `const { getDefaultConfig } = require('react-native/metro-config');

export default {
  ...getDefaultConfig(__dirname),
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', configWithRequire);

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use CommonJS require syntax since file already has require
      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).not.toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should use ESM style when config has existing import statements', async () => {
      const configWithImport = `import { getDefaultConfig } from 'react-native/metro-config';

module.exports = {
  ...getDefaultConfig(__dirname),
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', configWithImport);

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use ESM import syntax since file already has imports
      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).not.toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle multiline ESM imports', async () => {
      const configWithMultilineImport = `import {
  getDefaultConfig,
  mergeConfig
} from 'react-native/metro-config';

export default getDefaultConfig(__dirname);`;

      const configPath = await createConfigFile(
        'metro',
        configWithMultilineImport
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use ESM import syntax since file already has multiline imports
      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).not.toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle multiline CommonJS destructuring', async () => {
      const configWithMultilineRequire = `const {
  getDefaultConfig,
  mergeConfig
} = require('react-native/metro-config');

module.exports = getDefaultConfig(__dirname);`;

      const configPath = await createConfigFile(
        'metro',
        configWithMultilineRequire
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use CommonJS require syntax since file already has multiline require
      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).not.toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should detect already wrapped config with multiline import', async () => {
      const alreadyWrappedMultiline = `import {
  withRozenite
} from '@rozenite/metro';

export default withRozenite({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
});`;

      const configPath = await createConfigFile(
        'metro',
        alreadyWrappedMultiline
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should remain unchanged since it's already properly wrapped
      expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
        alreadyWrappedMultiline.replace(/\s+/g, ' ')
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should detect already wrapped config with multiline require', async () => {
      const alreadyWrappedMultilineRequire = `const {
  withRozenite
} = require('@rozenite/metro');

module.exports = withRozenite({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
});`;

      const configPath = await createConfigFile(
        'metro',
        alreadyWrappedMultilineRequire
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should remain unchanged since it's already properly wrapped
      expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
        alreadyWrappedMultilineRequire.replace(/\s+/g, ' ')
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle imports with comments and extra whitespace', async () => {
      const configWithCommentedImport = `// Import metro config utilities
import {
  // Default configuration
  getDefaultConfig,
  // Configuration merger
  mergeConfig,
} from 'react-native/metro-config';

// Export the configuration
export default getDefaultConfig(__dirname);`;

      const configPath = await createConfigFile(
        'metro',
        configWithCommentedImport
      );

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should use ESM import syntax and preserve existing structure
      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).toContain(
        'export default withRozenite(getDefaultConfig(__dirname))'
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle real-world complex config with multiline requires and existing wrapper', async () => {
      const realWorldConfig = `const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozeniteExpoAtlasPlugin } = require('@rozenite/expo-atlas-plugin');
const { withRozenite } = require('@rozenite/metro');

const {
  withRozeniteReduxDevTools,
} = require('@rozenite/redux-devtools-plugin/metro');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const customConfig = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        inlineRequires: true,
      },
    }),
  },
};

module.exports = withRozenite(
  withNxMetro(mergeConfig(defaultConfig, customConfig), {
    debug: false,
    extensions: [],
  })
);`;

      const configPath = await createConfigFile('metro', realWorldConfig);

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      // Should remain unchanged since it's already properly wrapped with multiline requires
      expect(wrappedContent.replace(/\s+/g, ' ')).toBe(
        realWorldConfig.replace(/\s+/g, ' ')
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });
  });

  describe('file extension detection', () => {
    it('should handle .mjs files with ESM syntax', async () => {
      const esmConfig = `export default {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', esmConfig, '.mjs');

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).toContain('export default withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle .cjs files with CommonJS syntax', async () => {
      const cjsConfig = `module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', cjsConfig, '.cjs');

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).toContain('module.exports = withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle .mjs files with mixed content but force ESM', async () => {
      // Even if content looks like CommonJS, .mjs should force ESM
      const mixedConfig = `// This looks like CommonJS but file is .mjs
const something = require('something');

export default {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', mixedConfig, '.mjs');

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/metro';"
      );
      expect(wrappedContent).toContain('export default withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle .cjs files with mixed content but force CommonJS', async () => {
      // Even if content looks like ESM, .cjs should force CommonJS
      const mixedConfig = `// This looks like ESM but file is .cjs
import something from 'something';

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', mixedConfig, '.cjs');

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).toContain('module.exports = withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should find config files with different extensions', async () => {
      // Test that it finds .mjs when .js doesn't exist
      const esmConfig = `export default {
  transformer: {},
};`;

      await createConfigFile('metro', esmConfig, '.mjs');

      // Should not throw error
      await expect(wrapConfigFile(tempDir, 'metro')).resolves.not.toThrow();
    });

    it('should handle repack .mjs files', async () => {
      const repackEsmConfig = `export default {
  entry: './src/index.js',
  output: {
    path: process.cwd() + '/dist',
  },
};`;

      const configPath = await createConfigFile(
        'repack',
        repackEsmConfig,
        '.mjs'
      );

      await wrapConfigFile(tempDir, 'repack');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "import { withRozenite } from '@rozenite/repack';"
      );
      expect(wrappedContent).toContain('export default withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error when config file does not exist', async () => {
      await expect(wrapConfigFile(tempDir, 'metro')).rejects.toThrow(
        'Configuration file metro.config.{.js,.mjs,.cjs,.ts,.cts,.mts} not found'
      );
    });

    it('should throw error when repack config file does not exist', async () => {
      await expect(wrapConfigFile(tempDir, 'repack')).rejects.toThrow(
        'Configuration file rspack.config.{.js,.mjs,.cjs,.ts,.cts,.mts} not found'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle config with comments', async () => {
      const configWithComments = `// Metro configuration
/* Multi-line comment */
module.exports = {
  // Transformer options
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};`;

      const configPath = await createConfigFile('metro', configWithComments);

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        "const { withRozenite } = require('@rozenite/metro');"
      );
      expect(wrappedContent).toContain('withRozenite({');
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });

    it('should handle config with mixed quote styles', async () => {
      const configWithMixedQuotes = `const { getDefaultConfig } = require("react-native/metro-config");

module.exports = getDefaultConfig(__dirname);`;

      const configPath = await createConfigFile('metro', configWithMixedQuotes);

      await wrapConfigFile(tempDir, 'metro');

      const wrappedContent = await fs.readFile(configPath, 'utf8');

      expect(wrappedContent).toContain(
        'const { withRozenite } = require("@rozenite/metro");'
      );
      expect(validateJavaScript(wrappedContent)).toBe(true);
    });
  });
});
