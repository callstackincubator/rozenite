// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { XmlTree } from '../XmlTree';

const parseXml = (source: string): Element => {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  return doc.documentElement;
};

describe('XmlTree', () => {
  it('renders the root tag name', () => {
    render(<XmlTree root={parseXml('<feed/>')} />);
    // Self-closing — no closing tag, so a single occurrence is expected.
    expect(screen.getAllByText('feed')).toHaveLength(1);
  });

  it('renders attributes inline with the open tag', () => {
    render(<XmlTree root={parseXml('<entry id="42" lang="en"/>')} />);
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('lang')).toBeInTheDocument();
    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('renders non-whitespace text content', () => {
    render(<XmlTree root={parseXml('<title>Hello world</title>')} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('filters whitespace-only text nodes between sibling elements', () => {
    // Pretty-printed XML has whitespace text nodes between every sibling
    // element. After filtering, only the two <item> elements survive —
    // no stray text nodes containing the source's `\n  ` indentation.
    const { container } = render(
      <XmlTree
        root={parseXml('<list>\n  <item>a</item>\n  <item>b</item>\n</list>')}
      />,
    );
    // Each <item> renders as open + close tag, so 2 items × 2 = 4
    // occurrences of "item" text.
    expect(screen.getAllByText('item')).toHaveLength(4);
    // The leaf text values are present.
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    // The original source's whitespace indentation between <item>
    // siblings should not appear as a standalone text node. The exact
    // pattern "\n  " (newline + two spaces) was between siblings; if
    // we'd rendered it, the textContent would contain that fragment
    // outside of the element tags.
    const allText = container.textContent ?? '';
    expect(allText).not.toMatch(/<\/item>\s*\n\s+<item>/);
  });

  it('renders CDATA content wrapped in <![CDATA[ ... ]]> markers', () => {
    render(
      <XmlTree root={parseXml('<content><![CDATA[<p>html</p>]]></content>')} />,
    );
    expect(screen.getByText('<![CDATA[')).toBeInTheDocument();
    expect(screen.getByText(']]>')).toBeInTheDocument();
    expect(screen.getByText('<p>html</p>')).toBeInTheDocument();
  });

  it('recursively renders nested elements', () => {
    render(
      <XmlTree
        root={parseXml('<feed><entry><title>T</title></entry></feed>')}
      />,
    );
    // Each non-self-closing element renders open + close, hence 2x.
    expect(screen.getAllByText('feed')).toHaveLength(2);
    expect(screen.getAllByText('entry')).toHaveLength(2);
    expect(screen.getAllByText('title')).toHaveLength(2);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('hides children via display:none on collapse (does not unmount)', () => {
    // The whole point of using display:none rather than `{!collapsed
    // && <Children/>}` is that nested collapse state survives a parent
    // collapse/expand cycle. Verify the mechanism directly at the DOM
    // level: after collapsing, the inner element's tag name STILL
    // appears in the rendered tree (it's in the DOM, just hidden).
    const { container } = render(
      <XmlTree root={parseXml('<outer><inner>v</inner></outer>')} />,
    );

    // Both elements visible initially.
    expect(container.textContent).toContain('inner');

    // Collapse outer. There is one chevron button on outer (since
    // outer has a renderable child); click it.
    const chevronButtons = container.querySelectorAll('button');
    fireEvent.click(chevronButtons[0]);

    // Inner's tag name MUST still be in the DOM textContent — that's
    // the unmount-vs-display-none assertion. If we used unmount, the
    // string "inner" would have vanished entirely.
    expect(container.textContent).toContain('inner');

    // The children container should have display:none applied so the
    // inner element is visually hidden.
    const hiddenContainers = container.querySelectorAll(
      'div[style*="display: none"]',
    );
    expect(hiddenContainers.length).toBeGreaterThan(0);
  });

  it('toggles the chevron icon aria-label between Collapse and Expand', () => {
    const { container } = render(
      <XmlTree root={parseXml('<outer><inner/></outer>')} />,
    );
    const button = container.querySelector('button');
    if (!button) throw new Error('expected a chevron button');
    expect(button.getAttribute('aria-label')).toBe('Collapse');
    fireEvent.click(button);
    expect(button.getAttribute('aria-label')).toBe('Expand');
    fireEvent.click(button);
    expect(button.getAttribute('aria-label')).toBe('Collapse');
  });

  it('renders a self-closing form when the element has no renderable children', () => {
    const { container } = render(<XmlTree root={parseXml('<empty/>')} />);
    // Self-closing should render as `<empty />` — i.e. there should be
    // no separate closing tag span. Look for the inline " />" marker.
    expect(container.textContent).toContain('/>');
    // No closing-tag line — i.e. no `</empty>` rendered.
    expect(container.textContent ?? '').not.toContain('</empty>');
  });

  it('renders a closing tag for elements with children', () => {
    const { container } = render(
      <XmlTree root={parseXml('<wrap><child/></wrap>')} />,
    );
    // wrap should have `</wrap>` closing tag visible.
    expect(container.textContent ?? '').toContain('</');
  });

  it('preserves namespace prefixes in element names', () => {
    render(
      <XmlTree
        root={parseXml(
          '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><media:thumbnail/></feed>',
        )}
      />,
    );
    expect(screen.getByText('media:thumbnail')).toBeInTheDocument();
  });
});
