// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ViewToggle } from '../ViewToggle';

describe('ViewToggle', () => {
  it('renders nothing when only one view is available (adaptive)', () => {
    const { container } = render(
      <ViewToggle views={['raw']} value="raw" onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the renderer offers no views', () => {
    const { container } = render(
      <ViewToggle views={[]} value="raw" onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders both labels when preview and raw are available', () => {
    render(
      <ViewToggle
        views={['preview', 'raw']}
        value="preview"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Raw' })).toBeInTheDocument();
  });

  it('marks the active view as aria-selected', () => {
    render(
      <ViewToggle views={['preview', 'raw']} value="raw" onChange={() => {}} />,
    );
    expect(screen.getByRole('tab', { name: 'Raw' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('fires onChange with the clicked view', () => {
    const onChange = vi.fn();
    render(
      <ViewToggle
        views={['preview', 'raw']}
        value="preview"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('raw');
  });

  it('stops click propagation so toggle clicks do not collapse the parent Section', () => {
    // The toggle lives inside the Section header, which is itself a
    // <button> that collapses on click — without stopPropagation, every
    // toggle click would also collapse the section.
    const onChange = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <ViewToggle
          views={['preview', 'raw']}
          value="preview"
          onChange={onChange}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));
    expect(onChange).toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
