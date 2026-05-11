import type { FormSnapshot } from './types';

export type RHFUpdateEvent = {
  type: 'update';
  snapshot: FormSnapshot;
};

export type RHFUnmountEvent = {
  type: 'unmount';
  id: string;
};

export type RHFEventMap = {
  update: RHFUpdateEvent;
  unmount: RHFUnmountEvent;
};
