// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CodeBlock } from '../CodeBlock';

describe('CodeBlock', () => {
  it('renders small string content as a <pre> (no virtualization)', () => {
    const { container } = render(<CodeBlock>{'a'.repeat(100)}</CodeBlock>);
    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(screen.queryByTestId('virtuoso-mock')).toBeNull();
  });

  it('stays flat at exactly the 50_000-character boundary (inclusive)', () => {
    // The branch condition is `> 50_000`, so length === 50_000 must
    // still render as <pre>. Locks the inclusive-boundary semantics.
    const { container } = render(<CodeBlock>{'a'.repeat(50_000)}</CodeBlock>);
    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(screen.queryByTestId('virtuoso-mock')).toBeNull();
  });

  it('switches to virtualized rendering at 50_001 characters', () => {
    const { container } = render(<CodeBlock>{'a'.repeat(50_001)}</CodeBlock>);
    expect(screen.getByTestId('virtuoso-mock')).toBeInTheDocument();
    // No <pre> emitted by CodeBlock when on the virtualized path.
    expect(container.querySelector('pre')).toBeNull();
  });

  it('preserves the body content across the virtualization threshold', () => {
    // Build a body whose head and tail are recognizable tokens. The
    // vi.mock passthrough renders every row, so both ends should be
    // visible in the DOM after virtualization kicks in.
    const filler = 'x'.repeat(50_000);
    const body = `START\n${filler}\nEND`;
    render(<CodeBlock>{body}</CodeBlock>);
    expect(screen.getByTestId('virtuoso-mock')).toBeInTheDocument();
    expect(screen.getByText('START')).toBeInTheDocument();
    expect(screen.getByText('END')).toBeInTheDocument();
  });

  it('splits virtualized content into one row per newline', () => {
    const lines = ['line-a', 'line-b', 'line-c'];
    // Pad with a single long line so total length crosses the threshold,
    // keeping the lines themselves short and matchable.
    const body = `${lines.join('\n')}\n${'y'.repeat(50_001)}`;
    render(<CodeBlock>{body}</CodeBlock>);
    expect(screen.getByText('line-a')).toBeInTheDocument();
    expect(screen.getByText('line-b')).toBeInTheDocument();
    expect(screen.getByText('line-c')).toBeInTheDocument();
  });

  it('renders React-element children unchanged regardless of nested content size', () => {
    // typeof children !== 'string' MUST take precedence — even if the
    // wrapped element contains an enormous string internally, CodeBlock
    // should stay on the flat <pre> path because the children prop
    // itself is a React element, not a string.
    const huge = 'z'.repeat(50_001);
    const { container } = render(
      <CodeBlock>
        <div data-testid="custom-child">{huge}</div>
      </CodeBlock>,
    );
    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(screen.queryByTestId('virtuoso-mock')).toBeNull();
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });

  it('forwards className to the flat <pre> branch', () => {
    const { container } = render(
      <CodeBlock className="extra-class">{'short'}</CodeBlock>,
    );
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.className).toContain('extra-class');
  });

  it('forwards className to the virtualized branch via Virtuoso', () => {
    const { container } = render(
      <CodeBlock className="extra-class">{'a'.repeat(50_001)}</CodeBlock>,
    );
    const mockRoot = container.querySelector('[data-testid="virtuoso-mock"]');
    expect(mockRoot).toBeInTheDocument();
    // The vi.mock passthrough forwards `className` onto the wrapper so
    // we can assert the prop reached Virtuoso. The real Virtuoso applies
    // it to its outer scroll container, giving the same dark-bg /
    // monospace / border styling as the flat <pre> branch.
    expect(mockRoot?.className).toContain('extra-class');
  });
});
