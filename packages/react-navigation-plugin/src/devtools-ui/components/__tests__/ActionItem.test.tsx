// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionItem } from '../ActionItem';
import type {
  ActionOrigin,
  ActionStackFrame,
} from '../../../react-native/symbolication/types';
import type { NavigationAction } from '../../../shared';

const appFrame: ActionStackFrame = {
  functionName: 'handlePress',
  url: 'apps/playground/src/Screen.tsx',
  lineNumber: 42,
  columnNumber: 5,
  generatedUrl: 'http://localhost:8081/index.bundle?platform=ios',
  generatedLineNumber: 12345,
  generatedColumnNumber: 10,
};

const baseAction = {
  type: 'NAVIGATE',
  payload: { name: 'Home' },
} as unknown as NavigationAction;

const renderItem = (origin: ActionOrigin | undefined) =>
  render(
    <ActionItem
      action={baseAction}
      origin={origin}
      index={0}
      isSelected={false}
      onSelect={vi.fn()}
      onGoToAction={vi.fn()}
    />,
  );

const buildOrigin = (overrides: Partial<ActionOrigin>): ActionOrigin => ({
  rawStack: 'raw',
  frames: [appFrame],
  originFrame: appFrame,
  confidence: 'high',
  symbolicationStatus: 'complete',
  ...overrides,
});

describe('ActionItem origin preview', () => {
  it('shows the file basename + line preview for high-confidence complete origins', () => {
    renderItem(buildOrigin({}));
    expect(screen.getByText('↳ Screen.tsx:42:5')).toBeInTheDocument();
  });

  it('exposes the full path as a hover tooltip', () => {
    renderItem(buildOrigin({}));
    const preview = screen.getByText('↳ Screen.tsx:42:5');
    expect(preview).toHaveAttribute(
      'title',
      'apps/playground/src/Screen.tsx:42:5',
    );
  });

  it('renders the preview italicised for low-confidence origins', () => {
    renderItem(buildOrigin({ confidence: 'low' }));
    const preview = screen.getByText('↳ Screen.tsx:42:5');
    expect(preview.className).toMatch(/italic/);
  });

  it('shows a "Resolving…" indicator while the origin is pending', () => {
    renderItem(
      buildOrigin({
        symbolicationStatus: 'pending',
        confidence: 'none',
        originFrame: undefined,
      }),
    );
    expect(screen.getByText('↳ Resolving…')).toBeInTheDocument();
  });

  it('renders no preview for failed / unavailable / none-confidence states', () => {
    const { rerender } = renderItem(
      buildOrigin({ symbolicationStatus: 'failed', originFrame: undefined }),
    );
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();

    rerender(
      <ActionItem
        action={baseAction}
        origin={buildOrigin({
          symbolicationStatus: 'unavailable',
          originFrame: undefined,
        })}
        index={0}
        isSelected={false}
        onSelect={vi.fn()}
        onGoToAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();

    rerender(
      <ActionItem
        action={baseAction}
        origin={buildOrigin({
          confidence: 'none',
          originFrame: undefined,
        })}
        index={0}
        isSelected={false}
        onSelect={vi.fn()}
        onGoToAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();
  });

  it('renders no preview when origin is undefined (no stack captured)', () => {
    renderItem(undefined);
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();
  });
});
