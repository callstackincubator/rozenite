import type { ControlsSectionSnapshot } from './types';

export type ControlsSnapshotEvent = {
  type: 'snapshot';
  sections: ControlsSectionSnapshot[];
};

export type ControlsGetSnapshotEvent = {
  type: 'get-snapshot';
};

export type ControlsInvokeActionEvent = {
  type: 'invoke-action';
  sectionId: string;
  itemId: string;
  action: 'toggle' | 'press';
  value?: boolean;
};

export type ControlsEvent =
  | ControlsSnapshotEvent
  | ControlsGetSnapshotEvent
  | ControlsInvokeActionEvent;

export type ControlsEventMap = {
  [K in ControlsEvent['type']]: Extract<ControlsEvent, { type: K }>;
};
