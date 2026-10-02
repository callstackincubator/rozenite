import { describe, expect, it } from 'vitest';
import { parseAgentTargetsResponse } from '../targets-response.js';

const target = { id: 'a-1', deviceId: 'a', pageId: '1' };

describe('parseAgentTargetsResponse', () => {
  it('returns the targets of a success envelope', () => {
    expect(
      parseAgentTargetsResponse(200, {
        ok: true,
        result: { targets: [target] },
      }),
    ).toEqual({
      kind: 'targets',
      targets: [target],
    });
  });

  it('returns an empty targets array as targets', () => {
    expect(parseAgentTargetsResponse(200, { ok: true, result: { targets: [] } })).toEqual({
      kind: 'targets',
      targets: [],
    });
  });

  it('prefers the error envelope over the HTTP status', () => {
    expect(
      parseAgentTargetsResponse(400, {
        ok: false,
        error: { message: 'No connected device' },
      }),
    ).toEqual({ kind: 'error-envelope', message: 'No connected device' });
  });

  it('reports an error envelope without a string message', () => {
    expect(parseAgentTargetsResponse(404, { ok: false })).toEqual({
      kind: 'error-envelope',
      message: undefined,
    });
    expect(parseAgentTargetsResponse(404, { ok: false, error: { message: 5 } })).toEqual({
      kind: 'error-envelope',
      message: undefined,
    });
  });

  it('treats a missing or invalid body as unexpected, keeping the status class', () => {
    expect(parseAgentTargetsResponse(200, undefined)).toEqual({
      kind: 'unexpected',
      httpOk: true,
    });
    expect(parseAgentTargetsResponse(500, null)).toEqual({
      kind: 'unexpected',
      httpOk: false,
    });
    expect(parseAgentTargetsResponse(404, 'text')).toEqual({
      kind: 'unexpected',
      httpOk: false,
    });
    expect(parseAgentTargetsResponse(200, [])).toEqual({
      kind: 'unexpected',
      httpOk: true,
    });
    expect(parseAgentTargetsResponse(200, { other: 1 })).toEqual({
      kind: 'unexpected',
      httpOk: true,
    });
  });

  it('treats a success envelope without a targets array as unexpected', () => {
    expect(parseAgentTargetsResponse(200, { ok: true })).toEqual({
      kind: 'unexpected',
      httpOk: true,
    });
    expect(parseAgentTargetsResponse(200, { ok: true, result: { targets: {} } })).toEqual({
      kind: 'unexpected',
      httpOk: true,
    });
  });
});
