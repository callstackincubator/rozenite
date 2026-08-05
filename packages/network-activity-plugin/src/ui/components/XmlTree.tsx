import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { JsonTreeCopyableItem } from './JsonTreeCopyableItem';

export type XmlTreeProps = {
  root: Element;
};

export const XmlTree = ({ root }: XmlTreeProps) => {
  return (
    <div className="font-mono text-sm text-gray-200">
      <XmlNode node={root} depth={0} />
    </div>
  );
};

type XmlNodeProps = {
  node: Node;
  depth: number;
};

// Whitespace-only text between sibling elements is DOM-pretty-print
// noise. Filter it so a 10-element document doesn't render as 21 nodes.
// Mixed content like `<p>Hello <b>world</b>!</p>` survives because its
// fragments contain non-whitespace.
const isWhitespaceOnlyText = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE && /^\s*$/.test(node.nodeValue ?? '');

const renderableChildren = (node: Node): Node[] =>
  Array.from(node.childNodes).filter((child) => !isWhitespaceOnlyText(child));

const XmlNode = ({ node, depth }: XmlNodeProps) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return <XmlElementNode element={node as Element} depth={depth} />;
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return <XmlCDataNode cdata={node as CDATASection} depth={depth} />;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return <XmlTextNode text={node as Text} depth={depth} />;
  }
  // Comments, processing instructions, DOCTYPE — intentionally not
  // rendered in the tree. They're rare in API responses; the Raw view
  // still shows them verbatim.
  return null;
};

type XmlElementNodeProps = {
  element: Element;
  depth: number;
};

const XmlElementNode = ({ element, depth }: XmlElementNodeProps) => {
  const [expanded, setExpanded] = useState(true);
  const children = renderableChildren(element);
  const hasChildren = children.length > 0;
  const tagName = element.nodeName;
  const attributes = Array.from(element.attributes);

  // Self-closing if no renderable children.
  const isSelfClosing = !hasChildren;

  const serializeSubtree = () => new XMLSerializer().serializeToString(element);

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : `1rem` }}>
      <div className="flex items-start">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 mr-1 -ml-5 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : null}
        <JsonTreeCopyableItem getCopyableValue={serializeSubtree}>
          <span>
            <span className="text-gray-500">&lt;</span>
            <span className="text-blue-400">{tagName}</span>
            {attributes.map((attr) => (
              <XmlAttribute key={attr.name} attr={attr} />
            ))}
            <span className="text-gray-500">{isSelfClosing ? ' />' : '>'}</span>
          </span>
        </JsonTreeCopyableItem>
      </div>

      {hasChildren ? (
        <>
          <div style={{ display: expanded ? 'block' : 'none' }}>
            {children.map((child, idx) => (
              <XmlNode key={idx} node={child} depth={depth + 1} />
            ))}
          </div>
          {/* Collapsed inline closing tag preview — gives a visual hint
              of what was collapsed. */}
          {!expanded ? <span className="text-gray-500 ml-1">…</span> : null}
          <div>
            <span className="text-gray-500">&lt;/</span>
            <span className="text-blue-400">{tagName}</span>
            <span className="text-gray-500">&gt;</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

const XmlAttribute = ({ attr }: { attr: Attr }) => (
  <>
    <span> </span>
    <span className="text-amber-400">{attr.name}</span>
    <span className="text-gray-500">=</span>
    <span className="text-gray-500">&quot;</span>
    <span className="text-green-400">{attr.value}</span>
    <span className="text-gray-500">&quot;</span>
  </>
);

type XmlTextNodeProps = {
  text: Text;
  depth: number;
};

const XmlTextNode = ({ text, depth }: XmlTextNodeProps) => {
  const value = text.nodeValue ?? '';
  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : `1rem` }}>
      <JsonTreeCopyableItem getCopyableValue={() => value}>
        <span className="text-gray-200">{value}</span>
      </JsonTreeCopyableItem>
    </div>
  );
};

type XmlCDataNodeProps = {
  cdata: CDATASection;
  depth: number;
};

const XmlCDataNode = ({ cdata, depth }: XmlCDataNodeProps) => {
  const value = cdata.nodeValue ?? '';
  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : `1rem` }}>
      <JsonTreeCopyableItem getCopyableValue={() => value}>
        <span>
          <span className="text-purple-400">&lt;![CDATA[</span>
          <span className="text-gray-200 whitespace-pre-wrap">{value}</span>
          <span className="text-purple-400">]]&gt;</span>
        </span>
      </JsonTreeCopyableItem>
    </div>
  );
};
