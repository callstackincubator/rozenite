import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnCapturingOutput, Subprocess } from './spawn.js';
import { fileExists } from './files.js';

export type PluginTarget = 'react-native' | 'metro' | 'sdk';

export type ModuleFormat = 'esm' | 'cjs';

export type TscEmit = {
  target: PluginTarget;
  format: ModuleFormat;
  /** Output directory, relative to the project root. */
  outDir: string;
  declaration: boolean;
};

export const TARGET_ENTRY_FILE: Record<PluginTarget, string> = {
  'react-native': 'react-native.ts',
  metro: 'metro.ts',
  sdk: 'sdk.ts',
};

export const TARGET_LABEL: Record<PluginTarget, string> = {
  'react-native': 'React Native',
  metro: 'Metro',
  sdk: 'SDK',
};

// Generated tsconfig files live in the project so `extends` and the relative
// entry paths stay simple, and so a failing build leaves the exact config
// behind for inspection.
const GENERATED_CONFIG_DIR = '.rozenite';

/**
 * React Native code is consumed by Metro, which handles ES modules natively.
 * Metro only enables `package.json` exports by default from React Native 0.79
 * (Metro 0.82) onwards, so 0.76-0.78 still resolve the root entry through
 * `main` and need the CommonJS output alongside it.
 *
 * Metro and SDK code is consumed by Node, where a single CommonJS build behind
 * the `default` condition serves `require()` and `import` alike. Emitting only
 * CommonJS also keeps `__dirname` and friends available to config authors.
 */
export const getTscEmits = (target: PluginTarget): TscEmit[] => {
  if (target === 'react-native') {
    return [
      { target, format: 'esm', outDir: 'dist/react-native', declaration: true },
      { target, format: 'cjs', outDir: 'dist/react-native/cjs', declaration: false },
    ];
  }

  return [{ target, format: 'cjs', outDir: `dist/${target}`, declaration: true }];
};

const getConfigFileName = (emit: TscEmit): string => {
  return `tsconfig.${emit.target}.${emit.format}.json`;
};

const createTsconfig = (emit: TscEmit) => {
  const isEsm = emit.format === 'esm';

  return {
    extends: '../tsconfig.json',
    compilerOptions: {
      // A plugin's own tsconfig is a type-checking config, so undo everything
      // that would stop it from producing output.
      noEmit: false,
      emitDeclarationOnly: false,
      composite: false,
      incremental: false,
      // Never publish output that failed to type check.
      noEmitOnError: true,
      declaration: emit.declaration,
      declarationMap: false,
      sourceMap: false,
      // CommonJS output cannot carry ESM-only syntax through verbatim.
      verbatimModuleSyntax: false,
      module: isEsm ? 'ESNext' : 'CommonJS',
      // `bundler` is what keeps extensionless relative imports valid, but it
      // is only compatible with ES module output, so CommonJS uses `node10` -
      // which is equally forgiving about extensions.
      moduleResolution: isEsm ? 'bundler' : 'node10',
      // Resolve dependencies through their published entry points. Without
      // this, the `development` condition that plugin tsconfigs enable for
      // editor support would pull workspace *sources* into the build.
      customConditions: null,
      rootDir: '..',
      outDir: path.posix.join('..', emit.outDir),
    },
    files: [path.posix.join('..', TARGET_ENTRY_FILE[emit.target])],
    // The entry graph alone would miss ambient declarations - global
    // augmentations and module shims are never imported, only declared.
    include: ['../*.d.ts', '../src/**/*.d.ts'],
  };
};

export const writeTargetTsconfig = async (projectRoot: string, emit: TscEmit): Promise<string> => {
  const configDir = path.join(projectRoot, GENERATED_CONFIG_DIR);
  await fs.mkdir(configDir, { recursive: true });

  const configPath = path.join(configDir, getConfigFileName(emit));
  await fs.writeFile(configPath, JSON.stringify(createTsconfig(emit), null, 2) + '\n');

  return configPath;
};

/**
 * TypeScript cannot emit `.cjs` or `.mjs` from `.ts` sources, and renaming the
 * output afterwards would break the extensionless relative specifiers it
 * emits. A `package.json` marker in the output directory tells Node how to
 * interpret the plain `.js` files instead.
 */
export const writeModuleTypeMarker = async (projectRoot: string, emit: TscEmit): Promise<void> => {
  const outDir = path.join(projectRoot, emit.outDir);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, 'package.json'),
    JSON.stringify({ type: emit.format === 'esm' ? 'module' : 'commonjs' }, null, 2) + '\n',
  );
};

export const assertTsconfigExists = async (projectRoot: string): Promise<void> => {
  if (await fileExists(path.join(projectRoot, 'tsconfig.json'))) {
    return;
  }

  throw new Error(
    'A tsconfig.json is required at the plugin root. Rozenite compiles the React Native, ' +
      'Metro and SDK entry points with tsc, extending your tsconfig.json.',
  );
};

const withMissingTypescriptHint = (error: unknown): unknown => {
  if (
    error instanceof Error &&
    (error.cause as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
  ) {
    return new Error(
      'Could not run tsc. Rozenite compiles the React Native, Metro and SDK entry points ' +
        'with TypeScript - add `typescript` to the plugin devDependencies.',
      { cause: error },
    );
  }

  return error;
};

export type RunTscOptions = {
  signal?: AbortSignal;
};

export const runTsc = async (
  projectRoot: string,
  configPath: string,
  { signal }: RunTscOptions = {},
): Promise<void> => {
  try {
    // tsc reports diagnostics on stdout, which `spawnCapturingOutput` folds
    // into the error message when the compile fails.
    await spawnCapturingOutput('tsc', ['--project', configPath], {
      cwd: projectRoot,
      preferLocal: true,
      signal,
    });
  } catch (error) {
    throw withMissingTypescriptHint(error);
  }
};

export const spawnTscWatch = (projectRoot: string, configPath: string): Subprocess => {
  return spawn('tsc', ['--project', configPath, '--watch', '--preserveWatchOutput'], {
    cwd: projectRoot,
    preferLocal: true,
    handleSignals: false,
  });
};

/** Prepares the generated config and output marker for a single emit. */
export const prepareEmit = async (projectRoot: string, emit: TscEmit): Promise<string> => {
  const [configPath] = await Promise.all([
    writeTargetTsconfig(projectRoot, emit),
    writeModuleTypeMarker(projectRoot, emit),
  ]);

  return configPath;
};

export const buildTarget = async (
  projectRoot: string,
  target: PluginTarget,
  { signal }: RunTscOptions = {},
): Promise<void> => {
  await Promise.all(
    getTscEmits(target).map(async (emit) => {
      const configPath = await prepareEmit(projectRoot, emit);
      await runTsc(projectRoot, configPath, { signal });
    }),
  );
};
