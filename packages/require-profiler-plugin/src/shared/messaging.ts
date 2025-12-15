// Flame graph node structure compatible with react-flame-graph
export type RequireProfilerFlameGraphNode = {
  name: string;
  value: number;
  tooltip?: string;
  backgroundColor?: string;
  color?: string;
  children?: RequireProfilerFlameGraphNode[];
};

export type RequireProfilerRequestDataEvent = {
  type: 'request-data';
};

export type RequireProfilerDataResponseEvent = {
  type: 'data-response';
  data: RequireProfilerFlameGraphNode | null;
};

export type RequireProfilerEvent =
  | RequireProfilerRequestDataEvent
  | RequireProfilerDataResponseEvent;

export type RequireProfilerEventMap = {
  [K in RequireProfilerEvent['type']]: Extract<
    RequireProfilerEvent,
    { type: K }
  >;
};
