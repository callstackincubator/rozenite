import type { HttpMethod, NetworkEventSource } from '../../shared/client';

export type RequestTypeFilter = 'http' | 'websocket' | 'sse';

export type AdvancedFilterState = {
  methods: Set<HttpMethod>;
  sources: Set<NetworkEventSource>;
  status: string;
  domain: string;
  contentType: string;
  failedOnly: boolean;
  inFlightOnly: boolean;
  overriddenOnly: boolean;
  minSize: string;
  maxSize: string;
  minDuration: string;
  maxDuration: string;
};

export type FilterState = {
  text: string;
  types: Set<RequestTypeFilter>;
  advanced: AdvancedFilterState;
};

export const DEFAULT_REQUEST_TYPES: RequestTypeFilter[] = [
  'http',
  'websocket',
  'sse',
];

export const createDefaultFilter = (): FilterState => ({
  text: '',
  types: new Set(DEFAULT_REQUEST_TYPES),
  advanced: {
    methods: new Set(),
    sources: new Set(),
    status: '',
    domain: '',
    contentType: '',
    failedOnly: false,
    inFlightOnly: false,
    overriddenOnly: false,
    minSize: '',
    maxSize: '',
    minDuration: '',
    maxDuration: '',
  },
});
