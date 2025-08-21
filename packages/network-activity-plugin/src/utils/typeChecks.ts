export const isBlob = (value: unknown): value is Blob => value instanceof Blob;

export const isArrayBuffer = (
  value: unknown
): value is ArrayBuffer | ArrayBufferView =>
  value instanceof ArrayBuffer || ArrayBuffer.isView(value);

export const isFormData = (value: unknown): value is FormData =>
  value instanceof FormData;

export const isNullOrUndefined = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

export const isString = (value: unknown): value is string =>
  typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value);

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

export const isArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);
