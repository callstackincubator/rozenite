import { getHttpHeaderValue } from '../ui/utils/getHttpHeaderValue';

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type LastOf<T> = UnionToIntersection<
  T extends unknown ? () => T : never
> extends () => infer R
  ? R
  : never;

type Push<T extends unknown[], V> = [...T, V];

export type UnionToTuple<T, L = LastOf<T>> = [T] extends [never]
  ? []
  : Push<UnionToTuple<Exclude<T, L>>, L>;

export const getContentType = (request: XMLHttpRequest): string => {
  const responseHeaders = request.responseHeaders;
  const responseType = request.responseType;

  const contentType = getHttpHeaderValue(responseHeaders || {}, 'content-type');

  if (contentType) {
    return contentType.split(';')[0].trim();
  }

  switch (responseType) {
    case 'arraybuffer':
    case 'blob':
      return 'application/octet-stream';
    case 'text':
    case '':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'document':
      return 'text/html';
  }
};
