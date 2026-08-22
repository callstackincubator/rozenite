import { RequireChainMeta, RequireChainData, BundleCoverage } from './types';

export type RequireProfilerRequestChainsListEvent = Record<string, unknown>;

export type RequireProfilerChainsListResponseEvent = {
  chains: RequireChainMeta[];
};

export type RequireProfilerRequestChainDataEvent = {
  chainIndex: number;
};

export type RequireProfilerChainDataResponseEvent = {
  data: RequireChainData | null;
};

export type RequireProfilerReloadAndProfileEvent = Record<string, unknown>;

export type RequireProfilerNewChainEvent = {
  chain: RequireChainMeta;
};

export type RequireProfilerRequestBundleCoverageEvent = Record<string, unknown>;

export type RequireProfilerBundleCoverageResponseEvent = {
  coverage: BundleCoverage;
};

export type RequireProfilerEventMap = {
  'request-chains-list': RequireProfilerRequestChainsListEvent;
  'chains-list-response': RequireProfilerChainsListResponseEvent;
  'request-chain-data': RequireProfilerRequestChainDataEvent;
  'chain-data-response': RequireProfilerChainDataResponseEvent;
  'reload-and-profile': RequireProfilerReloadAndProfileEvent;
  'new-chain': RequireProfilerNewChainEvent;
  'request-bundle-coverage': RequireProfilerRequestBundleCoverageEvent;
  'bundle-coverage-response': RequireProfilerBundleCoverageResponseEvent;
};
