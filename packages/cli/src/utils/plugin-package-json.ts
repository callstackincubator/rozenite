import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from './files.js';

type PackageJSON = {
  [key: string]: unknown;
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, string | PackageExportsEntry>;
};

type PackageExportsEntry = {
  development?: string;
  types: string;
  import?: string;
  require?: string;
  default?: string;
};

type PackageExports = Record<string, string | PackageExportsEntry>;

type PluginPackageContract = {
  main: string;
  module: string;
  types: string;
  exports: PackageExports;
};

type PluginTargets = {
  hasReactNativeEntryPoint: boolean;
  hasMetroEntryPoint: boolean;
  hasSdkEntryPoint: boolean;
  hasRegisterEntryPoint: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BUILDER_MANAGED_FIELDS = ['main', 'module', 'types', 'exports'] as const;

const buildPackageContract = (targets: PluginTargets): PluginPackageContract | null => {
  if (!targets.hasReactNativeEntryPoint) {
    return null;
  }

  // Output file names follow the entry point file names, because tsc emits a
  // file tree rooted at the plugin directory rather than a single bundle.
  const contract: PluginPackageContract = {
    // React Native 0.76-0.78 ship Metro 0.81, which does not enable
    // `package.json` exports by default and resolves this entry through
    // `main`. `@rozenite/middleware` also resolves plugins with
    // `require.resolve`, which needs a `require`-satisfiable condition.
    main: './dist/react-native/cjs/react-native.js',
    module: './dist/react-native/react-native.js',
    types: './dist/react-native/react-native.d.ts',
    exports: {
      '.': {
        types: './dist/react-native/react-native.d.ts',
        import: './dist/react-native/react-native.js',
        require: './dist/react-native/cjs/react-native.js',
      },
      './package.json': './package.json',
    },
  };

  // Node-facing entry points ship as CommonJS only. `default` (rather than
  // `require`) is what lets both `require()` in a metro.config.js and `import`
  // in a metro.config.mjs resolve the same file.
  if (targets.hasMetroEntryPoint) {
    contract.exports['./metro'] = {
      types: './dist/metro/metro.d.ts',
      default: './dist/metro/metro.js',
    };
  }

  if (targets.hasSdkEntryPoint) {
    contract.exports['./sdk'] = {
      development: './sdk.ts',
      types: './dist/sdk/sdk.d.ts',
      default: './dist/sdk/sdk.js',
    };
  }

  // `register.ts` compiles as an extra file inside the `react-native` target
  // (see `getTscEmits`'s `extraEntryFiles`), so its output sits alongside
  // `react-native.js` in the same emitted tree - same shape as the `.` entry.
  if (targets.hasRegisterEntryPoint) {
    contract.exports['./register'] = {
      types: './dist/react-native/register.d.ts',
      import: './dist/react-native/register.js',
      require: './dist/react-native/cjs/register.js',
    };
  }

  return contract;
};

const isEqual = (left: unknown, right: unknown): boolean => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const isPackageExports = (value: unknown): value is PackageExports => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return true;
};

const mergeManagedExports = (
  existingExports: unknown,
  contract: PluginPackageContract,
  targets: PluginTargets,
): PackageExports => {
  const mergedExports = isPackageExports(existingExports) ? { ...existingExports } : {};

  mergedExports['.'] = contract.exports['.'];
  mergedExports['./package.json'] = contract.exports['./package.json'];

  if (targets.hasMetroEntryPoint) {
    mergedExports['./metro'] = contract.exports['./metro'];
  } else {
    delete mergedExports['./metro'];
  }

  if (targets.hasSdkEntryPoint) {
    mergedExports['./sdk'] = contract.exports['./sdk'];
  } else {
    delete mergedExports['./sdk'];
  }

  if (targets.hasRegisterEntryPoint) {
    mergedExports['./register'] = contract.exports['./register'];
  } else {
    delete mergedExports['./register'];
  }

  return mergedExports;
};

const formatPackageJSON = (value: PackageJSON): string => {
  return JSON.stringify(value, null, 2) + '\n';
};

export type SyncPluginPackageJSONResult = {
  updatedFields: string[];
  targets: PluginTargets;
};

export const detectPluginTargets = async (projectRoot: string): Promise<PluginTargets> => {
  return {
    hasReactNativeEntryPoint: await fileExists(path.join(projectRoot, 'react-native.ts')),
    hasMetroEntryPoint: await fileExists(path.join(projectRoot, 'metro.ts')),
    hasSdkEntryPoint: await fileExists(path.join(projectRoot, 'sdk.ts')),
    hasRegisterEntryPoint: await fileExists(path.join(projectRoot, 'register.ts')),
  };
};

export const syncPluginPackageJSON = async (
  projectRoot: string,
): Promise<SyncPluginPackageJSONResult> => {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJSON;
  const targets = await detectPluginTargets(projectRoot);
  const contract = buildPackageContract(targets);
  const updatedPackageJson: PackageJSON = { ...packageJson };
  const updatedFields: string[] = [];

  const updateField = <T extends (typeof BUILDER_MANAGED_FIELDS)[number]>(
    field: T,
    nextValue: PackageJSON[T] | undefined,
  ) => {
    if (nextValue === undefined) {
      if (field in updatedPackageJson) {
        delete updatedPackageJson[field];
        updatedFields.push(field);
      }

      return;
    }

    if (!isEqual(updatedPackageJson[field], nextValue)) {
      updatedPackageJson[field] = nextValue;
      updatedFields.push(field);
    }
  };

  if (contract) {
    updateField('main', contract.main);
    updateField('module', contract.module);
    updateField('types', contract.types);

    const mergedExports = mergeManagedExports(updatedPackageJson.exports, contract, targets);

    updateField('exports', mergedExports);
  } else if (
    updatedPackageJson.exports !== undefined &&
    isPackageExports(updatedPackageJson.exports) &&
    ('./metro' in updatedPackageJson.exports ||
      './sdk' in updatedPackageJson.exports ||
      './register' in updatedPackageJson.exports)
  ) {
    const nextExports = { ...updatedPackageJson.exports };
    delete nextExports['./metro'];
    delete nextExports['./sdk'];
    delete nextExports['./register'];
    updateField('exports', nextExports);
  }

  if (updatedFields.length > 0) {
    await fs.writeFile(packageJsonPath, formatPackageJSON(updatedPackageJson));
  }

  return {
    updatedFields,
    targets,
  };
};
