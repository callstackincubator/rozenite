import {
  RequestId,
  Request,
  Response,
  Initiator,
  ResourceType,
  HttpHeaders,
} from '../shared/client';

export type NetworkEntry = {
  requestId: RequestId;
  url: string;
  method: string;
  headers: HttpHeaders;
  body?: {
    type: string;
    data: string;
  };
  status: 'pending' | 'loading' | 'finished' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  ttfb?: number;
  type?: ResourceType;
  initiator?: Initiator;
  request?: Request;
  response?: Response;
  responseBody?: {
    body: string | null;
  };
  error?: string;
  canceled?: boolean;
  size?: number;
};
