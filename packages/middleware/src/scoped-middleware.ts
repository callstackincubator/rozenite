import type { IncomingMessage, ServerResponse } from 'node:http';

export type MiddlewareRequest = IncomingMessage & {
  url?: string;
};

export type MiddlewareNext = (error?: unknown) => void;

export type MiddlewareHandler = (
  req: MiddlewareRequest,
  res: ServerResponse,
  next: MiddlewareNext,
) => void;

const matchesPrefix = (url: string, prefix: string): boolean => {
  return url === prefix || url.startsWith(prefix + '/');
};

const withFinishedResponseGuard = (
  middleware: MiddlewareHandler,
): MiddlewareHandler => {
  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      // Some upstream middleware incorrectly calls next() after it already ended
      // the response. Stop the chain here so later middleware does not try to
      // write headers again and crash with ERR_HTTP_HEADERS_SENT.
      if (res.headersSent || res.writableEnded) {
        return;
      }

      next();
    });
  };
};

export const createScopedMiddleware = (
  prefix: string,
  middleware: MiddlewareHandler,
): MiddlewareHandler => {
  const guardedMiddleware = withFinishedResponseGuard(middleware);

  return (req, res, next) => {
    if (!req.url || !matchesPrefix(req.url, prefix)) {
      next();
      return;
    }

    const originalUrl = req.url;
    const scopedUrl = req.url.slice(prefix.length) || '/';
    req.url = scopedUrl.startsWith('/') ? scopedUrl : '/' + scopedUrl;

    guardedMiddleware(req, res, (error) => {
      req.url = originalUrl;

      if (error) {
        next(error);
        return;
      }

      next();
    });
  };
};
