declare type BlobData = {
  blobId: string;
  lastModified?: number;
  name?: string;
  offset: number;
  size: number;
  type?: string;
};

declare global {
  interface XMLHttpRequest {
    _requestId?: number;
    _subscriptions: Array<EventSubscription>;
    _aborted: boolean;
    _cachedResponse: Response;
    _hasError: boolean;
    _headers: { [key: string]: string };
    _lowerCaseResponseHeaders: { [key: string]: string };
    _method?: string | null;
    _perfKey?: string | null;
    _responseType: ResponseType;
    _response: string | BlobData;
    _sent: boolean;
    _url?: string | null;
    _timedOut: boolean;
    _trackingName?: string;
    _incrementalEvents: boolean;
    _startTime?: number | null;
    responseHeaders?: { [key: string]: string };
  }
}

export {};
