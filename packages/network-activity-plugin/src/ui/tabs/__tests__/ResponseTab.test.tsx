// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResponseTab } from '../ResponseTab';
import type { HttpNetworkEntry } from '../../state/model';
import type { ResponseView } from '../../response-renderers';

const makeSvgEntry = (id: string, source: string): HttpNetworkEntry => ({
  id,
  type: 'http',
  timestamp: 0,
  status: 'finished',
  request: {
    url: `https://example.com/${id}.svg`,
    method: 'GET',
    headers: {},
  },
  response: {
    url: `https://example.com/${id}.svg`,
    status: 200,
    statusText: 'OK',
    headers: {},
    contentType: 'image/svg+xml',
    size: source.length,
    responseTime: 0,
    body: { type: 'image/svg+xml', data: source },
  },
});

// Mirrors the SidePanel structure that surfaced the original bug:
// `preferredView` lives in the parent; an outer wrapper is keyed on
// `selectedRequest.id` to match `SidePanel.tsx`'s
// `<Tabs key={selectedRequest.id}>` semantics (the wrapper forces a
// remount of ResponseTab on every request switch, which is intentional
// for other reasons — see SidePanel comments).
const StickyPreferenceHarness = ({
  initialRequest,
  nextRequest,
}: {
  initialRequest: HttpNetworkEntry;
  nextRequest: HttpNetworkEntry;
}) => {
  const [request, setRequest] = useState<HttpNetworkEntry>(initialRequest);
  const [preferredView, setPreferredView] = useState<ResponseView>('preview');
  return (
    <>
      <button onClick={() => setRequest(nextRequest)}>switch-request</button>
      <div key={request.id}>
        <ResponseTab
          selectedRequest={request}
          preferredView={preferredView}
          onPreferredViewChange={setPreferredView}
          onRequestResponseBody={() => {}}
        />
      </div>
    </>
  );
};

describe('ResponseTab — sticky Preview/Raw preference', () => {
  it('persists the toggle across a keyed remount triggered by a request switch', () => {
    const first = makeSvgEntry('first', '<svg id="first"/>');
    const second = makeSvgEntry('second', '<svg id="second"/>');

    render(
      <StickyPreferenceHarness initialRequest={first} nextRequest={second} />,
    );

    // Preview is the default view for the SVG renderer — an inline <img>
    // is rendered, no <pre> source view yet.
    expect(screen.getByRole('img')).toBeInTheDocument();

    // Flip to Raw via the ViewToggle.
    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('<svg id="first"/>')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Raw' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Switch to a different request. The wrapper's `key` changes, so the
    // ResponseTab subtree is unmounted and a fresh instance mounts —
    // exactly the situation that caused the original sticky-preference
    // bug when state lived inside ResponseTab.
    fireEvent.click(screen.getByRole('button', { name: 'switch-request' }));

    // The new request's body should be visible (proves the remount
    // happened and we are now rendering the second entry).
    expect(screen.getByText('<svg id="second"/>')).toBeInTheDocument();
    // And — the regression guard — the toggle should still be on Raw,
    // not reset to the renderer's Preview default. The lifted state in
    // the parent harness survived the keyed remount.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Raw' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
