import type { ResponseRenderer } from './types';

// Defensive last-resort match — every preceding renderer should already
// have claimed any well-formed body. Reaching this renderer means the
// wire format produced a shape no one handles, which is a bug somewhere
// upstream. The label exposes the content-type for the bug report.
export const unknownRenderer: ResponseRenderer = {
  id: 'unknown',
  matches: () => true,
  views: [],
  defaultView: 'raw',
  supportsOverride: false,
  render: ({ ctx }) => (
    <div className="text-sm text-gray-400">
      Could not display response (Content-Type: {ctx.contentType || 'unknown'})
    </div>
  ),
};
