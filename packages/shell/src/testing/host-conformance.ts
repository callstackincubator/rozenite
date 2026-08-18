import { describe, expect, it } from 'vitest';
import type { ShellHost } from '../host';

/** Sentinel `expectedSent` can return to mean "this host is expected to
 * not forward this message to the transport at all" — see `expectedSent`
 * below. */
export const DROPPED = Symbol('shell-host-conformance-dropped');

export type ShellHostConformanceSetup = {
  /** The host implementation under test. */
  host: ShellHost;
  /**
   * Simulate the other side of the transport delivering `message` to
   * `host`, as if it had arrived over the wire. Used to exercise
   * `host.onMessage`.
   */
  deliver: (message: unknown) => void;
  /** Messages `host.send` has handed to the underlying transport so far, in order. */
  sent: () => unknown[];
  /**
   * Maps a message passed to `host.send` to what `sent()` is expected to
   * contain for it — most hosts forward it unchanged, which is the
   * default (identity). A host that transforms or conditionally drops
   * outgoing messages (e.g. unwrapping an envelope, or dropping a shape it
   * never expects to see in practice) can supply this to assert its own
   * real contract instead of the suite forcing every host through the
   * same literal-equality check. Return `DROPPED` to assert the message
   * was not forwarded at all.
   */
  expectedSent?: (message: unknown) => unknown;
};

/**
 * Reusable vitest suite asserting the `ShellHost` contract: `send` reaches
 * the transport, `onMessage` delivers, its returned unsubscribe stops
 * delivery, and multiple listeners each receive independently.
 *
 * Call it once per host implementation with a `setup` factory that wires up
 * a fresh host — plus a way to observe/simulate its transport — for every
 * test, e.g.:
 *
 * ```ts
 * runShellHostConformance('createParentWindowHost', () => {
 *   const host = createParentWindowHost();
 *   // ... wire up `sent` and `deliver` for this host's transport ...
 *   return { host, sent, deliver };
 * });
 * ```
 */
export const runShellHostConformance = (
  name: string,
  setup: () => ShellHostConformanceSetup,
): void => {
  describe(`ShellHost conformance: ${name}`, () => {
    it('delivers messages sent via `send`, as this host defines "delivers"', () => {
      const { host, sent, expectedSent = (message) => message } = setup();
      const message = { hello: 'world' };

      const expected = expectedSent(message);
      host.send(message);

      expect(sent()).toEqual(expected === DROPPED ? [] : [expected]);
    });

    it('delivers incoming messages to a subscribed listener', () => {
      const { host, deliver } = setup();
      const received: unknown[] = [];
      host.onMessage((message) => received.push(message));

      const message = { ping: true };
      deliver(message);

      expect(received).toEqual([message]);
    });

    it('stops delivering after the returned unsubscribe is called', () => {
      const { host, deliver } = setup();
      const received: unknown[] = [];
      const unsubscribe = host.onMessage((message) => received.push(message));

      unsubscribe();
      deliver({ ping: true });

      expect(received).toEqual([]);
    });

    it('delivers to every subscribed listener', () => {
      const { host, deliver } = setup();
      const receivedA: unknown[] = [];
      const receivedB: unknown[] = [];
      host.onMessage((message) => receivedA.push(message));
      host.onMessage((message) => receivedB.push(message));

      const message = { ping: true };
      deliver(message);

      expect(receivedA).toEqual([message]);
      expect(receivedB).toEqual([message]);
    });
  });
};
