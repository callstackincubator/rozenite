import type { FormSnapshot } from './types';

export type RHFUpdateEvent = {
  type: 'update';
  snapshot: FormSnapshot;
};

export type RHFEventMap = {
  update: RHFUpdateEvent;
};
