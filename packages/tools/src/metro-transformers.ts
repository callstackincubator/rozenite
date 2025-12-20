import type { ConfigT as MetroConfig } from 'metro-config';

type MetroConfigObject = MetroConfig;
type MetroConfigPromise = Promise<MetroConfig>;
type MetroConfigFunction = (baseConfig: MetroConfig) => MetroConfig;
type MetroConfigAsyncFunction = (
  baseConfig: MetroConfig,
) => Promise<MetroConfig>;
type MetroConfigPromiseOfFunction = Promise<
  MetroConfigFunction | MetroConfigAsyncFunction
>;

export type AnyMetroConfig =
  | MetroConfigObject
  | MetroConfigPromise
  | MetroConfigFunction
  | MetroConfigAsyncFunction
  | MetroConfigPromiseOfFunction;

// Transformer composition types
type Transformer<TOptions = void> = <T extends AnyMetroConfig>(
  input: T,
  options?: TOptions,
) => MutatedType<T>;

type TransformerWithOptions<TOptions = unknown> = [
  Transformer<TOptions>,
  TOptions,
];

type TransformerEntry = Transformer<void> | TransformerWithOptions<unknown>;

// Type inference helpers for mutator return types
export type MutatedType<T> = T extends MetroConfigObject
  ? MetroConfig | Promise<MetroConfig> // Object can become Promise if mutation is async
  : T extends MetroConfigPromise
    ? Promise<MetroConfig> // Promise stays Promise
    : T extends MetroConfigFunction
      ? (baseConfig: MetroConfig) => MetroConfig | Promise<MetroConfig> // Function stays function
      : T extends MetroConfigAsyncFunction
        ? (baseConfig: MetroConfig) => Promise<MetroConfig> // Async function stays async function
        : T extends MetroConfigPromiseOfFunction
          ? Promise<
              (baseConfig: MetroConfig) => MetroConfig | Promise<MetroConfig>
            > // Promise of function stays Promise of function
          : never;

/**
 * Creates a Metro config transformer that can handle all possible Metro config export formats.
 *
 * The transformer preserves the "shape" of the input while applying transformations:
 * - Object input → Object output (or Promise if transformation is async)
 * - Promise input → Promise output
 * - Function input → Function output
 * - Async function input → Async function output
 * - Promise of function input → Promise of function output
 *
 * @param mutate - Function that performs the actual config transformation
 * @returns A transformer function that accepts any Metro config format
 */
export const createMetroConfigTransformer = <TOptions = void>(
  mutate: (
    config: MetroConfig,
    options?: TOptions,
  ) => MetroConfig | Promise<MetroConfig>,
) => {
  return <T extends AnyMetroConfig>(
    input: T,
    options?: TOptions,
  ): MutatedType<T> => {
    // 1. Handle function inputs (sync and async config functions)
    if (typeof input === 'function') {
      return ((baseConfig: MetroConfig) => {
        const result = input(baseConfig);
        // Handle both sync and async function results
        if (result instanceof Promise) {
          return result.then((config) => mutate(config, options));
        }
        return mutate(result, options);
      }) as MutatedType<T>;
    }

    // 2. Handle Promise inputs (Promise of object or Promise of function)
    if (input instanceof Promise) {
      return input.then((resolved) => {
        // The resolved value might be a function or an object
        if (typeof resolved === 'function') {
          // Return a wrapped function that applies mutation
          return (baseConfig: MetroConfig) => {
            const result = resolved(baseConfig);
            if (result instanceof Promise) {
              return result.then((config) => mutate(config, options));
            }
            return mutate(result, options);
          };
        }
        // It's an object, apply mutation directly
        return mutate(resolved, options);
      }) as MutatedType<T>;
    }

    // 3. Handle object inputs (plain config object)
    return mutate(input, options) as MutatedType<T>;
  };
};

/**
 * Composes multiple Metro config transformers together using a Babel-like tuple syntax.
 *
 * Supports both simple transformers and transformers with options:
 * - Simple: `withRequireProfiler`
 * - With options: `[withExpoAtlas, { projectRoot: __dirname }]`
 *
 * @param entries - Array of transformers, either plain functions or [function, options] tuples
 * @returns A composed transformer function that applies all transformers in sequence
 *
 * @example
 * ```typescript
 * const combinedTransformer = composeMetroConfigTransformers(
 *   withRequireProfiler,
 *   [withExpoAtlas, { projectRoot: __dirname }],
 *   withReduxDevTools
 * );
 *
 * module.exports = combinedTransformer(getDefaultConfig(__dirname));
 * ```
 */
export const composeMetroConfigTransformers = (
  ...entries: TransformerEntry[]
) => {
  return <T extends AnyMetroConfig>(input: T): MutatedType<T> => {
    // Reduce through all transformers, chaining them together
    return entries.reduce<AnyMetroConfig>((acc, entry) => {
      // Check if entry is a tuple [transformer, options] or plain transformer
      if (Array.isArray(entry)) {
        const [transformer, options] = entry;
        return transformer(acc, options) as unknown as AnyMetroConfig;
      }
      return entry(acc) as unknown as AnyMetroConfig;
    }, input) as unknown as MutatedType<T>;
  };
};
