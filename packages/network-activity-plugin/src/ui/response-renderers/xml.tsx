import { CodeBlock } from '../components/CodeBlock';
import { XmlTree } from '../components/XmlTree';
import { isXmlContentType } from '../../utils/getContentTypeMimeType';
import type { ResponseRenderer } from './types';

// DOMParser does not throw on malformed XML — instead it produces a
// Document containing a `<parsererror>` element, but with different
// placement across engines: Chrome/Safari put it as `documentElement`;
// Firefox nests it under a dedicated namespace. Cover both.
const FIREFOX_PARSERERROR_NS =
  'http://www.mozilla.org/newlayout/xml/parsererror.xml';

const hasParseError = (doc: Document): boolean =>
  doc.documentElement.nodeName === 'parsererror' ||
  doc.getElementsByTagNameNS(FIREFOX_PARSERERROR_NS, 'parsererror').length > 0;

export const xmlRenderer: ResponseRenderer = {
  id: 'xml',
  matches: (contentType, body) =>
    typeof body === 'string' && isXmlContentType(contentType),
  views: ['preview', 'raw'],
  defaultView: 'preview',
  supportsOverride: true,
  render: ({ view, body }) => {
    if (typeof body !== 'string') return null;
    const doc = new DOMParser().parseFromString(body, 'application/xml');
    if (hasParseError(doc)) {
      return (
        <>
          <CodeBlock>{body}</CodeBlock>
          <div className="text-xs text-gray-500 mt-1">
            ⚠️ Failed to parse as XML, showing as raw text
          </div>
        </>
      );
    }
    if (view === 'raw') {
      return <CodeBlock>{body}</CodeBlock>;
    }
    return (
      <CodeBlock>
        <XmlTree root={doc.documentElement} />
      </CodeBlock>
    );
  },
};
