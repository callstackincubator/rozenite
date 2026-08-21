import { describe, expect, it } from 'vitest';
import { TargetUrlError, parseTargetFromUrl } from './target-from-url';

describe('parseTargetFromUrl', () => {
  it('resolves a leading-slash ws path against the page host and protocol', () => {
    const url = new URL(
      'http://localhost:8081/rozenite/app/?ws=%2Finspector%2Fdebug%3Fdevice%3Dabc123%26page%3D1&appId=com.example.app',
    );

    expect(parseTargetFromUrl(url)).toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc123&page=1',
      deviceId: 'abc123',
      pageId: '1',
      appId: 'com.example.app',
    });
  });

  it('uses wss when the page itself was loaded over https', () => {
    const url = new URL(
      'https://example.com/rozenite/app/?ws=%2Finspector%2Fdebug%3Fdevice%3Dabc123%26page%3D1&appId=com.example.app',
    );

    expect(parseTargetFromUrl(url).webSocketDebuggerUrl).toBe(
      'wss://example.com/inspector/debug?device=abc123&page=1',
    );
  });

  it('resolves a host:port/path ws value without a leading slash', () => {
    const url = new URL(
      'http://localhost:8081/?ws=127.0.0.1%3A8081%2Finspector%2Fdebug%3Fdevice%3Dabc123%26page%3D2&appId=com.example.app',
    );

    expect(parseTargetFromUrl(url)).toEqual({
      webSocketDebuggerUrl: 'ws://127.0.0.1:8081/inspector/debug?device=abc123&page=2',
      deviceId: 'abc123',
      pageId: '2',
      appId: 'com.example.app',
    });
  });

  it('defaults appId to an empty string when absent', () => {
    const url = new URL(
      'http://localhost:8081/?ws=%2Finspector%2Fdebug%3Fdevice%3Dabc123%26page%3D1',
    );

    expect(parseTargetFromUrl(url).appId).toBe('');
  });

  it('throws a TargetUrlError when "ws" is missing', () => {
    const url = new URL('http://localhost:8081/?appId=com.example.app');

    expect(() => parseTargetFromUrl(url)).toThrow(TargetUrlError);
    expect(() => parseTargetFromUrl(url)).toThrow(/ws/);
  });

  it('throws a TargetUrlError when "ws" has no device id', () => {
    const url = new URL('http://localhost:8081/?ws=%2Finspector%2Fdebug%3Fpage%3D1');

    expect(() => parseTargetFromUrl(url)).toThrow(TargetUrlError);
    expect(() => parseTargetFromUrl(url)).toThrow(/device/);
  });
});
