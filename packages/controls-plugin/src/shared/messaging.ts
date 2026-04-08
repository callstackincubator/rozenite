import type { ControlsSectionSnapshot } from './types';

export type ControlsSnapshotEvent = {
  type: 'snapshot';
  sections: ControlsSectionSnapshot[];
};

export type ControlsGetSnapshotEvent = {
  type: 'get-snapshot';
};

export type ControlsUpdateRequestEvent = {
  type: 'update-request';
  requestId: string;
  sectionId: string;
  itemId: string;
  value: boolean | string;
};

export type ControlsUpdateResultEvent = {
  type: 'update-result';
  requestId: string;
  sectionId: string;
  itemId: string;
  status: 'ok' | 'error';
  message?: string;
};

export type ControlsInvokeActionEvent = {
  type: 'invoke-action';
  sectionId: string;
  itemId: string;
  action: 'press';
};

export type ControlsEvent =
  | ControlsSnapshotEvent
  | ControlsGetSnapshotEvent
  | ControlsUpdateRequestEvent
  | ControlsUpdateResultEvent
  | ControlsInvokeActionEvent;

export type ControlsEventMap = {
  [K in ControlsEvent['type']]: Extract<ControlsEvent, { type: K }>;
};
