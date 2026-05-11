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

export type RHFEventMap = {
  init: RHFInitEvent;
  update: RHFUpdateEvent;
  unmount: RHFUnmountEvent;
};
