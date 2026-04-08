import { describe, expect, it } from 'vitest';
import { getNormalizedRequestUrl } from '../middleware.js';

describe('middleware request normalization', () => {
  it('preserves agent routes under /rozenite', () => {
    expect(getNormalizedRequestUrl('/rozenite/agent/targets')).toBe(
      '/rozenite/agent/targets',
    );
    expect(getNormalizedRequestUrl('/rozenite/agent/sessions/device-1')).toBe(
      '/rozenite/agent/sessions/device-1',
    );
  });

  it('continues stripping the /rozenite prefix for non-agent routes', () => {
    expect(getNormalizedRequestUrl('/rozenite/plugins/demo/index.js')).toBe(
      '/plugins/demo/index.js',
    );
    expect(getNormalizedRequestUrl('/rozenite/rn_fusebox.html')).toBe(
      '/rn_fusebox.html',
    );
  });
});
