import type { ReactNode } from 'react';
import type { ResponseBody } from '../../shared/client';

export type ResponseView = 'preview' | 'raw';

export type RenderCtx = {
  contentType: string;
  url: string;
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
