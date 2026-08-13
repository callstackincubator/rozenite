import type { FormSnapshot } from './types';

export type RHFInitEvent = {
  type: 'init';
};

export type RHFUpdateEvent = {
  type: 'update';
  snapshot: FormSnapshot;
};

export type RHFUnmountEvent = {
  type: 'unmount';
  id: string;
};

export type RHFResetFormRequestEvent = {
  type: 'reset-form';
  requestId: string;
  id: string;
};

export type RHFResetFormResponseEvent = {
  type: 'reset-form-result';
  requestId: string;
  id: string;
};

export type RHFRequestErrorEvent = {
  type: 'rhf-request-error';
  requestId: string;
  id: string;
  code: 'RESET_NOT_SUPPORTED';
  message: string;
};

export type RHFEventMap = {
  init: RHFInitEvent;
  update: RHFUpdateEvent;
  unmount: RHFUnmountEvent;
  'reset-form': RHFResetFormRequestEvent;
  'reset-form-result': RHFResetFormResponseEvent;
  'rhf-request-error': RHFRequestErrorEvent;
};
