export type RequireTimingNode = {
  name: string;
  value: number;
  tooltip: string;
  children: RequireTimingNode[];
};

export type RequireChainMeta = {
  index: number;
  rootModuleId: number | string;
  rootModuleName: string;
};

export type RequireChainData = RequireChainMeta & {
  tree: RequireTimingNode;
};
