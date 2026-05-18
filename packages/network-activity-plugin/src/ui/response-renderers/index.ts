import { binaryTooLargeRenderer } from './binary-too-large';
import { emptyRenderer } from './empty';
import { imageRenderer } from './image';
import { jsonRenderer } from './json';
import { svgRenderer } from './svg';
import { textFallbackRenderer } from './text-fallback';
import { unknownRenderer } from './unknown';
import type { ResponseBody } from '../../shared/client';
import type { ResponseRenderer } from './types';

export type {
  RenderCtx,
  ResponseRenderer,
  ResponseView,
  RenderArgs,
} from './types';

// Order matters: matches() is evaluated top to bottom, first hit wins.
// More specific predicates must come before more general ones — e.g.
// SVG must match before generic image/* (SVG bodies are strings, but
// the image renderer wouldn't claim them either; keeping SVG first is
// belt-and-suspenders). Binary-too-large precedes any binary handler.
// text-fallback catches every remaining string body; unknown is the
// defensive last-resort.
export const renderers: ResponseRenderer[] = [
  emptyRenderer,
  binaryTooLargeRenderer,
  svgRenderer,
  imageRenderer,
  jsonRenderer,
  textFallbackRenderer,
  unknownRenderer,
];

export const findRenderer = (
  contentType: string,
  body: ResponseBody,
): ResponseRenderer => {
  for (const renderer of renderers) {
    if (renderer.matches(contentType, body)) {
      return renderer;
    }
  }
  // `unknownRenderer` is the last entry with matches: () => true, so we
  // never reach this — but TypeScript can't see that.
  return unknownRenderer;
};
