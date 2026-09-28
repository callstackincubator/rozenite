import type {
  XHRPostData,
  RequestPostData,
  RequestTextPostData,
  RequestBinaryPostData,
  RequestFormDataPostData,
  HttpHeaders,
} from '../../shared/client';
import { safeStringify } from '../../utils/safeStringify';
import { isBlob, isArrayBuffer, isFormData, isNullOrUndefined } from '../../utils/typeChecks';
import { getBlobName } from '../utils/getBlobName';
import { getFormDataEntries } from '../utils/getFormDataEntries';

/** Appends a header value, turning a repeated header into an array — the one
 * rule every header-collecting call site (fetch's `Headers`, nitro's header
 * pair list, the XHR hook's `setRequestHeader`) needs. */
export const appendHeader = (headers: HttpHeaders, key: string, value: string): void => {
  const existing = headers[key];
  headers[key] =
    existing === undefined
      ? value
      : Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
};

const getBinaryPostData = (body: Blob): RequestBinaryPostData => ({
  type: 'binary',
  value: { size: body.size, type: body.type, name: getBlobName(body) },
});

const getArrayBufferPostData = (body: ArrayBuffer | ArrayBufferView): RequestBinaryPostData => ({
  type: 'binary',
  value: { size: body.byteLength },
});

const getTextPostData = (body: unknown): RequestTextPostData => ({
  type: 'text',
  value: safeStringify(body),
});

const getFormDataPostData = (body: FormData): RequestFormDataPostData => ({
  type: 'form-data',
  value: Array.from(getFormDataEntries(body)).reduce<RequestFormDataPostData['value']>(
    (acc, [key, value]) => {
      acc[key] = isBlob(value)
        ? getBinaryPostData(value)
        : isArrayBuffer(value)
          ? getArrayBufferPostData(value)
          : getTextPostData(value);
      return acc;
    },
    {},
  ),
});

export const getRequestBody = (body: XHRPostData): RequestPostData => {
  if (isNullOrUndefined(body)) return body;
  if (isBlob(body)) return getBinaryPostData(body);
  if (isArrayBuffer(body)) return getArrayBufferPostData(body);
  if (isFormData(body)) return getFormDataPostData(body);
  return getTextPostData(body);
};
