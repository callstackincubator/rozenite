import { beforeEach, describe, expect, it } from 'vitest';
import { encodeValue } from '../../shared/codec';
import { getStateResult } from '../agent-tools';
import {
  __resetRegistry,
  getLazyValue,
  hello,
  registerStore,
  type RegisterStoreOptions,
  type StoreAdapter,
} from '../store-registry';

const register = (
  name: string,
  getState: () => unknown,
  extra: Partial<RegisterStoreOptions> = {},
) =>
  registerStore({
    name,
    adapter: {
      getState,
      getActions: () => [],
      getPersistInfo: () => undefined,
    } as never as StoreAdapter,
    ...extra,
  });

beforeEach(() => __resetRegistry());

describe('store registry', () => {
  it('serves arguments over budget lazily', () => {
    const controller = register('Auth', () => ({}));
    const long = 'x'.repeat(20_000);
    controller.record({
      next: { user: 'ada' },
      action: { name: 'login', source: 'action', args: [long] },
    });

    const [arg] = hello().transitions[0].action.args ?? [];
    expect(arg).toMatchObject({ $t: 'lazy', path: ['$args', 0] });
    expect(getLazyValue('Auth', 1, ['$args', 0]).value).toBe(long);
  });

  it('gives agents the sanitized state', () => {
    register('Session', () => ({ token: 'secret', user: 'ada' }), {
      stateSanitizer: (state) => ({ ...(state as object), token: '***' }),
    });
    expect(getStateResult({ storeId: 'Session' }).state).toEqual({ token: '***', user: 'ada' });
  });

  it('treats a second store with the same name as a Fast Refresh replacement', () => {
    let state: unknown = { count: 0 };
    const first = register('Counter', () => state);
    state = { count: 1 };
    first.record({ next: state, action: { name: 'inc', source: 'action' } });

    state = { count: 5 };
    const again = register('Counter', () => state);
    const result = hello();
    expect(result.stores[0]).toMatchObject({ storeId: 'Counter', generation: 2 });
    expect(result.keyframes).toEqual([
      { storeId: 'Counter', seq: 0, state: encodeValue({ count: 0 }) },
    ]);
    expect(result.transitions.map((transition) => transition.action.source)).toEqual([
      'action',
      'reload',
    ]);

    // The replaced store is detached and warns instead of recording.
    first.record({ next: { count: 9 }, action: { name: 'inc', source: 'action' } });
    again.record({ next: { count: 6 }, action: { name: 'inc', source: 'action' } });
    expect(hello().transitions).toHaveLength(3);
    expect(hello().warnings).toEqual([expect.objectContaining({ code: 'duplicate-name' })]);
  });
});
