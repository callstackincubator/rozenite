export type RequireTimingNode = {
  /** File name of the module, used as the frame label. */
  name: string;
  /** Total evaluation time in milliseconds, including children. */
  value: number;
  /** Evaluation time spent in this module alone, excluding children. */
  selfTime: number;
  /** Full module path. */
  tooltip: string;
  children: RequireTimingNode[];
};

export type RequireChainMeta = {
  index: number;
  rootModuleId: number | string;
  rootModuleName: string;
  /** Total evaluation time of the whole chain, in milliseconds. */
  duration: number;
  /** Number of modules evaluated as part of the chain. */
  moduleCount: number;
  /** Wall-clock timestamp (epoch milliseconds) of when the chain started. */
  startedAt: number;
};

export type RequireChainData = RequireChainMeta & {
  tree: RequireTimingNode | null;
};

export type BundleModuleInfo = {
  id: number | string;
  /** Module path where available, otherwise the numeric module id. */
  name: string;
  /** Whether the module had been evaluated at capture time. */
  evaluated: boolean;
};

export type BundleCoverage = {
  modules: BundleModuleInfo[];
  /** Wall-clock timestamp (epoch ms) when the registry was read. */
  capturedAt: number;
};
