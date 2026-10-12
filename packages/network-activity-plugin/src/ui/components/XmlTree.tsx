import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { JsonTreeCopyableItem } from './JsonTreeCopyableItem';

export type XmlTreeProps = {
  root: Element;
};

export const XmlTree = ({ root }: XmlTreeProps) => {
  return (
    <div className="pl-5 font-mono text-xs text-foreground">
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
            className="mt-0.5 mr-1 -ml-5 text-faint transition-colors duration-[120ms] hover:text-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : null}
        <JsonTreeCopyableItem getCopyableValue={serializeSubtree}>
          <span>
            <span className="text-faint">&lt;</span>
            <span className="text-foreground">{tagName}</span>
            {attributes.map((attr) => (
              <XmlAttribute key={attr.name} attr={attr} />
            ))}
            <span className="text-faint">{isSelfClosing ? ' />' : '>'}</span>
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
          {!expanded ? <span className="ml-1 text-faint">…</span> : null}
          <div>
            <span className="text-faint">&lt;/</span>
            <span className="text-foreground">{tagName}</span>
            <span className="text-faint">&gt;</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

const XmlAttribute = ({ attr }: { attr: Attr }) => (
  <>
    <span> </span>
    <span className="text-muted-foreground">{attr.name}</span>
    <span className="text-faint">=</span>
    <span className="text-faint">&quot;</span>
    <span className="text-primary">{attr.value}</span>
    <span className="text-faint">&quot;</span>
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
        <span className="text-foreground">{value}</span>
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
          <span className="text-faint">&lt;![CDATA[</span>
          <span className="whitespace-pre-wrap text-foreground">{value}</span>
          <span className="text-faint">]]&gt;</span>
        </span>
      </JsonTreeCopyableItem>
    </div>
  );
};
