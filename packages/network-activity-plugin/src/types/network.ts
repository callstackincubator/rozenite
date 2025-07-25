// Network types for the simplified event structure - limited to XMLHttpRequest capturable properties
import {
  NetworkRequestId,
  NetworkLoaderId,
  NetworkResourceType,
  NetworkRequest,
  NetworkResponse,
  NetworkInitiator,
} from './client';

export type NetworkEntry = {
  requestId: NetworkRequestId;
  loaderId?: NetworkLoaderId;
  documentURL?: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  hasPostData?: boolean;
  status: 'pending' | 'loading' | 'finished' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  type?: NetworkResourceType;
  initiator?: NetworkInitiator;
  request?: NetworkRequest;
  response?: NetworkResponse;
  errorText?: string;
  canceled?: boolean;
  encodedDataLength?: number;
  dataLength?: number;
};
