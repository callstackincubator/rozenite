import { describe, expect, it } from 'vitest';
import type { MetroTarget } from '@rozenite/agent-shared';
import { buildAppOpenUrl } from '../commands/open-url.js';

const target: MetroTarget = {
  id: '2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd',
  deviceId: '2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd',
  name: 'iPhone 15',
  appId: 'com.callstackincubator.rozenite',
  pageId: '1',
  title: 'Rozenite',
  description: '',
  webSocketDebuggerUrl:
    'ws://localhost:8081/inspector/debug?device=2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd&page=1',
};

describe('buildAppOpenUrl', () => {
  it('encodes the path + query of webSocketDebuggerUrl as the ws param', () => {
    const url = buildAppOpenUrl('127.0.0.1', 8081, target);

    expect(url).toBe(
      'http://127.0.0.1:8081/rozenite/app/?ws=%2Finspector%2Fdebug%3Fdevice%3D2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd%26page%3D1&appId=com.callstackincubator.rozenite',
    );
  });

  it('drops the debugger URL host/port, using the given host/port instead', () => {
    const url = buildAppOpenUrl('192.168.1.5', 9000, target);

    expect(url.startsWith('http://192.168.1.5:9000/rozenite/app/?')).toBe(true);
    expect(url).not.toContain('localhost:8081');
  });
});
