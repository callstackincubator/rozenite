import { describe, expectTypeOf, it } from 'vitest';
import { RozeniteRpc } from './types.js';

// Type-only assertions. `tsc -p tsconfig.lib.json --noEmit` (the package's
// `typecheck` script) checks every function body below regardless of
// whether it's ever called, so a wrong inference or a missing
// `@ts-expect-error` fails CI the same way a broken runtime test would.
//
// These helpers are declared but deliberately never invoked — `rpc` is a
// parameter, never a real value — so nothing here executes at runtime. The
// `it` blocks exist only so this file also reads as a normal vitest suite.

type TestMethods = {
  getUser: (params: { id: string }) => Promise<{ id: string; name: string }>;
  ping: () => Promise<'pong'>;
};

function checksParamsAndResultInference(rpc: RozeniteRpc<TestMethods>) {
  expectTypeOf(
    rpc.method('getUser').invoke({ id: '1' }),
  ).resolves.toEqualTypeOf<{
    id: string;
    name: string;
  }>();
  expectTypeOf(rpc.method('ping').invoke()).resolves.toEqualTypeOf<'pong'>();

  rpc.handle('getUser', (params) => {
    expectTypeOf(params).toEqualTypeOf<{ id: string }>();
    return Promise.resolve({ id: params.id, name: 'Ada' });
  });
}

function checksZeroArgHandleAcceptsNoParams(rpc: RozeniteRpc<TestMethods>) {
  rpc.method('ping').invoke();

  // @ts-expect-error -- `ping` takes no params; `invoke` accepts none.
  rpc.method('ping').invoke({ id: '1' });
}

function checksOptionsLiveOnlyOnMethod(rpc: RozeniteRpc<TestMethods>) {
  rpc.method('ping', { timeoutMs: 1_000 }).invoke();
  rpc.method('getUser', { timeoutMs: 1_000 }).invoke({ id: '1' });

  // @ts-expect-error -- `getUser` requires a `params` argument.
  rpc.method('getUser').invoke();

  // @ts-expect-error -- options belong on `method()`, not `invoke()`.
  rpc.method('getUser').invoke({ id: '1' }, { timeoutMs: 1_000 });
}

function checksUnknownMethodNamesAreATypeError(rpc: RozeniteRpc<TestMethods>) {
  // @ts-expect-error -- "doesNotExist" is not a key of TestMethods.
  rpc.method('doesNotExist');

  // @ts-expect-error -- same for handle().
  rpc.handle('doesNotExist', () => {});
}

describe('RozeniteRpc types', () => {
  it('infers params and result through the method handle', () => {
    expectTypeOf(checksParamsAndResultInference).toBeFunction();
  });

  it('method("zeroArg").invoke() is valid, invoke(params) is a type error', () => {
    expectTypeOf(checksZeroArgHandleAcceptsNoParams).toBeFunction();
  });

  it('options live only on method(); passing them to invoke() is a type error', () => {
    expectTypeOf(checksOptionsLiveOnlyOnMethod).toBeFunction();
  });

  it('unknown method names are a type error', () => {
    expectTypeOf(checksUnknownMethodNamesAreATypeError).toBeFunction();
  });
});
