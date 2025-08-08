import { RequestPostData } from '../shared/client';

export function inferContentTypeFromPostData(postData: RequestPostData) {
  if (postData?.type === 'form-data') {
    return 'multipart/form-data';
  }

  return undefined;
}
