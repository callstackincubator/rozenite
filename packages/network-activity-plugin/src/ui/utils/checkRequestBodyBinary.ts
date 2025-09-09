import { NetworkEntry } from '../state/model';

export const checkRequestBodyBinary = (request: NetworkEntry) => {
  return (
    request.type === 'http' && request.request.body?.data.type === 'binary'
  );
};
