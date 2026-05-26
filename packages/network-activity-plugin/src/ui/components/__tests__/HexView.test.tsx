// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getDefaultNormalizer, render, screen } from '@testing-library/react';
import { HexView } from '../HexView';

// Preserve the post-byte-8 double-space gap when matching hex rows —
// RTL's default normalizer collapses it.
const preserveWhitespace = {
  normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
};

describe('HexView', () => {
  it('renders a "no bytes" placeholder for an empty buffer', () => {
    render(<HexView bytes={new Uint8Array(0)} />);
    expect(screen.getByText(/no bytes to display/i)).toBeInTheDocument();
  });

  it('renders a row for a single-byte buffer', () => {
    render(<HexView bytes={new Uint8Array([0x41])} />);
    // Offset + hex pair are present somewhere in the rendered output.
    expect(screen.getByText('00000000')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    // ASCII column wraps the printable representation in pipes.
    expect(screen.getByText('|A|')).toBeInTheDocument();
  });

  it('renders a fully-formatted row with the post-byte-8 gap and ASCII column', () => {
    const bytes = new Uint8Array([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      0x0a, 0x0d, 0x09, 0xff,
    ]);
    render(<HexView bytes={bytes} />);
    expect(
      screen.getByText(
        '48 65 6C 6C 6F 20 77 6F  72 6C 64 21 0A 0D 09 FF',
        preserveWhitespace,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('|Hello world!....|')).toBeInTheDocument();
  });
});
