import type { ReactNode } from 'react';
import type { HttpHeaders, ResponseBody } from '../../shared/client';

export type ResponseView = 'preview' | 'raw';

export type RenderCtx = {
  contentType: string;
  url: string;
  // Response headers, used for fields like Content-Length and
  // Content-Disposition filename. Optional so renderers can be
  // tested with minimal fixtures.
  headers?: HttpHeaders;
  // Response size in bytes as reported by capture (may differ from
  // the decoded base64 length when the server gzips on the wire).
  size?: number;
  status?: number;
  statusText?: string;
};

export type RenderArgs = {
  view: ResponseView;
  body: ResponseBody;
  ctx: RenderCtx;
};

// A response-format renderer: a self-contained entry the dispatcher
// picks based on `matches`. Order in the `renderers` array is matching
// priority — first match wins, so narrower predicates come before
// wider fallbacks.
export type ResponseRenderer = {
  id: string;
  matches: (contentType: string, body: ResponseBody) => boolean;
  // Empty when the renderer has no toggleable views (e.g. a single
  // placeholder for empty bodies). The Preview/Raw toggle is hidden
  // unless `views.length > 1`.
  views: ResponseView[];
  defaultView: ResponseView;
  supportsOverride: boolean;
  render: (args: RenderArgs) => ReactNode;
};
