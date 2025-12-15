import { RequireTimingNode } from './types';

export type RequireProfilerRequestDataEvent = Record<string, unknown>;

export type RequireProfilerReloadAndProfileEvent = Record<string, unknown>;

export type RequireProfilerDataResponseEvent = {
  type: 'data-response';
  data: RequireTimingNode | null;
};

export type RequireProfilerEventMap = {
  'request-data': RequireProfilerRequestDataEvent;
  'reload-and-profile': RequireProfilerReloadAndProfileEvent;
  'data-response': RequireProfilerDataResponseEvent;
};
