import { describe, expect, it } from 'vitest';
import { connectFakePair } from './connect-fake-pair.js';

describe('connectFakePair', () => {
  it('delivers a message sent on device to panel, asynchronously', async () => {
    const { device, panel } = connectFakePair();
    const received: unknown[] = [];
    panel.onMessage((message) => received.push(message));

    device.send({ hello: 'device' });

    // Never delivered synchronously inside send() — matches every real
    // Channel implementation.
    expect(received).toEqual([]);

    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual([{ hello: 'device' }]);
  });

  it('delivers a message sent on panel to device', async () => {
    const { device, panel } = connectFakePair();
    const received: unknown[] = [];
    device.onMessage((message) => received.push(message));

    panel.send({ hello: 'panel' });
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual([{ hello: 'panel' }]);
  });

  it('supports multiple listeners and removing a subscription', async () => {
    const { device, panel } = connectFakePair();
    const a: unknown[] = [];
    const b: unknown[] = [];
    const subA = panel.onMessage((message) => a.push(message));
    panel.onMessage((message) => b.push(message));

    device.send('first');
    await Promise.resolve();
    await Promise.resolve();

    subA.remove();
    device.send('second');
    await Promise.resolve();
    await Promise.resolve();

    expect(a).toEqual(['first']);
    expect(b).toEqual(['first', 'second']);
  });

  it('close() clears listeners on that side only', async () => {
    const { device, panel } = connectFakePair();
    const received: unknown[] = [];
    panel.onMessage((message) => received.push(message));

    panel.close();
    device.send('after close');
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual([]);
  });

  it('dropDeviceToPanel silently drops messages device -> panel without affecting panel -> device', async () => {
    const { device, panel, dropDeviceToPanel } = connectFakePair();
    const fromDevice: unknown[] = [];
    const fromPanel: unknown[] = [];
    panel.onMessage((message) => fromDevice.push(message));
    device.onMessage((message) => fromPanel.push(message));

    dropDeviceToPanel(true);
    device.send('lost');
    panel.send('kept');
    await Promise.resolve();
    await Promise.resolve();

    expect(fromDevice).toEqual([]);
    expect(fromPanel).toEqual(['kept']);
  });

  it('delayPanelToDevice delays delivery by the given number of milliseconds', async () => {
    const { device, panel, delayPanelToDevice } = connectFakePair();
    const received: unknown[] = [];
    device.onMessage((message) => received.push(message));

    delayPanelToDevice(20);
    panel.send('slow');

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(received).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(received).toEqual(['slow']);
  });

  it('a listener that unsubscribes during dispatch does not affect the in-flight delivery', async () => {
    const { device, panel } = connectFakePair();
    const received: unknown[] = [];
    const sub = panel.onMessage(() => {
      sub.remove();
      received.push('first');
    });
    panel.onMessage(() => received.push('second'));

    device.send('message');
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual(['first', 'second']);
  });
});
