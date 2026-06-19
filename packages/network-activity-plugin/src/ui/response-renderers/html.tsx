import { CodeBlock } from '../components/CodeBlock';
import { normalizeContentType } from '../../utils/getContentTypeMimeType';
import type { ResponseRenderer } from './types';

// Primary defense is `sandbox=""` (empty value = all restrictions on),
// which blocks script execution and gives the iframe a unique origin.
// CSP is defense-in-depth against subresource fetches that sandbox does
// not block (external images, stylesheets, fonts) — without it, previewing
// arbitrary HTML would fire requests from the developer's browser to
// whatever URLs the captured response references.
const CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;">';

export const htmlRenderer: ResponseRenderer = {
  id: 'html',
  matches: (contentType, body) =>
    typeof body === 'string' &&
    normalizeContentType(contentType) === 'text/html',
  views: ['preview', 'raw'],
  defaultView: 'preview',
  supportsOverride: true,
  render: ({ view, body }) => {
    if (typeof body !== 'string') return null;
    if (view === 'raw') {
      return <CodeBlock>{body}</CodeBlock>;
    }
    return (
      <iframe
        title="HTML response preview"
        sandbox=""
        srcDoc={CSP_META + body}
        className="w-full h-[500px] bg-white border border-gray-700 rounded-md"
      />
    );
  },
};
