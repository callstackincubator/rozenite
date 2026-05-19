// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DispatchOriginSection } from '../DispatchOriginSection';
import type {
  ActionOrigin,
  ActionStackFrame,
} from '../../../react-native/symbolication/types';

const appFrame: ActionStackFrame = {
  functionName: 'handlePress',
  url: 'apps/playground/src/Screen.tsx',
  lineNumber: 42,
  columnNumber: 5,
  generatedUrl: 'http://localhost:8081/index.bundle?platform=ios',
  generatedLineNumber: 12345,
  generatedColumnNumber: 10,
};

const libraryFrame: ActionStackFrame = {
  functionName: 'dispatch',
  url: 'node_modules/@react-navigation/core/lib/dispatch.js',
  lineNumber: 100,
  columnNumber: 1,
  generatedUrl: 'http://localhost:8081/index.bundle?platform=ios',
  generatedLineNumber: 12340,
  generatedColumnNumber: 1,
};

const buildOrigin = (overrides: Partial<ActionOrigin> = {}): ActionOrigin => ({
  rawStack: 'raw\nstack\nstring',
  frames: [appFrame, libraryFrame],
  originFrame: appFrame,
  confidence: 'high',
  symbolicationStatus: 'complete',
  ...overrides,
});

describe('DispatchOriginSection', () => {
  it('renders the empty state when no origin is captured', () => {
    render(<DispatchOriginSection origin={undefined} />);
    expect(
      screen.getByText('No stack trace captured for this action.'),
    ).toBeInTheDocument();
  });

  it('renders the resolving headline while pending', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({
          symbolicationStatus: 'pending',
          originFrame: undefined,
          confidence: 'none',
        })}
      />,
    );
    expect(
      screen.getByText('Resolving origin from Metro…'),
    ).toBeInTheDocument();
  });

  it('renders the failure copy and error message', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({
          symbolicationStatus: 'failed',
          symbolicationError: 'Metro symbolication timed out after 5000ms',
          originFrame: undefined,
          confidence: 'none',
        })}
      />,
    );
    expect(
      screen.getByText('Could not source-map the stack via Metro.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Metro symbolication timed out after 5000ms'),
    ).toBeInTheDocument();
  });

  it('renders the unavailable copy in production / disconnected mode', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({
          symbolicationStatus: 'unavailable',
          originFrame: undefined,
          confidence: 'none',
        })}
      />,
    );
    expect(
      screen.getByText(/Stack trace symbolication is unavailable/),
    ).toBeInTheDocument();
  });

  it('renders a high-confidence headline without a confidence chip', () => {
    render(<DispatchOriginSection origin={buildOrigin()} />);
    expect(screen.getByText('handlePress')).toBeInTheDocument();
    expect(
      screen.getByText('apps/playground/src/Screen.tsx:42:5'),
    ).toBeInTheDocument();
    expect(screen.queryByText('low confidence')).not.toBeInTheDocument();
  });

  it('renders a low-confidence chip alongside the headline', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({
          confidence: 'low',
          originFrame: libraryFrame,
        })}
      />,
    );
    expect(screen.getByText('low confidence')).toBeInTheDocument();
  });

  it('renders the unresolved-origin copy when confidence is none', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({
          confidence: 'none',
          originFrame: undefined,
        })}
      />,
    );
    expect(
      screen.getByText('Could not resolve dispatch origin.'),
    ).toBeInTheDocument();
  });

  it('toggles the full stack on click and marks library frames', () => {
    render(<DispatchOriginSection origin={buildOrigin()} />);
    const toggle = screen.getByRole('button', {
      name: /Full stack \(2 frames\)/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('library')).toBeInTheDocument();
    // The path printer falls back to the last few segments for paths
    // outside a workspace root — node_modules paths render as their tail.
    expect(screen.getByText('core/lib/dispatch.js:100:1')).toBeInTheDocument();
  });

  it('expands the full stack by default when confidence is none', () => {
    render(
      <DispatchOriginSection
        origin={buildOrigin({ confidence: 'none', originFrame: undefined })}
      />,
    );
    const toggle = screen.getByRole('button', { name: /Full stack/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the code-frame snippet when present and omits it when absent', () => {
    // The producer (resolveDispatchOrigin) drops non-matching codeFrames
    // before they ever reach the section, so the section just trusts
    // what it gets: render if present, skip if not.
    const { rerender } = render(
      <DispatchOriginSection
        origin={buildOrigin({
          codeFrame: {
            fileName: 'apps/playground/src/Screen.tsx',
            content: '  42 |   handlePress();',
            line: 42,
            column: 5,
          },
        })}
      />,
    );
    expect(screen.getByTestId('dispatch-origin-code-frame')).toHaveTextContent(
      '42 | handlePress();',
    );

    rerender(
      <DispatchOriginSection origin={buildOrigin({ codeFrame: undefined })} />,
    );
    expect(
      screen.queryByTestId('dispatch-origin-code-frame'),
    ).not.toBeInTheDocument();
  });

  it('copies the verbatim raw stack and reflects success in the button label', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<DispatchOriginSection origin={buildOrigin()} />);
    const button = screen.getByRole('button', { name: 'Copy raw' });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith('raw\nstack\nstring');
    await screen.findByText('Copied');
  });
});
