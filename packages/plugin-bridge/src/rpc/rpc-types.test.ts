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
  expectTypeOf(rpc.invoke('getUser', { id: '1' })).resolves.toEqualTypeOf<{
    id: string;
    name: string;
  }>();
  expectTypeOf(rpc.invoke('ping')).resolves.toEqualTypeOf<'pong'>();

  rpc.handle('getUser', (params) => {
    expectTypeOf(params).toEqualTypeOf<{ id: string }>();
    return Promise.resolve({ id: params.id, name: 'Ada' });
  });
}

function checksZeroArgOverloads(rpc: RozeniteRpc<TestMethods>) {
  rpc.invoke('ping');
  rpc.invoke('ping', { timeoutMs: 1_000 });
}

function checksParamsAreRequiredWhenDeclared(rpc: RozeniteRpc<TestMethods>) {
  rpc.invoke('getUser', { id: '1' });
  rpc.invoke('getUser', { id: '1' }, { timeoutMs: 1_000 });

  // @ts-expect-error -- getUser requires a `params` argument.
  rpc.invoke('getUser');
}

function checksUnknownMethodNamesAreATypeError(rpc: RozeniteRpc<TestMethods>) {
  // @ts-expect-error -- "doesNotExist" is not a key of TestMethods.
  rpc.invoke('doesNotExist');

  // @ts-expect-error -- same for handle().
  rpc.handle('doesNotExist', () => {});
}

describe('RozeniteRpc types', () => {
  it('infers params and result from the method map', () => {
    expectTypeOf(checksParamsAndResultInference).toBeFunction();
  });

  it('zero-arg methods accept invoke("name") and invoke("name", { timeoutMs })', () => {
    expectTypeOf(checksZeroArgOverloads).toBeFunction();
  });

  it('methods with params require params to be passed', () => {
    expectTypeOf(checksParamsAreRequiredWhenDeclared).toBeFunction();
  });

  it('unknown method names are a type error', () => {
    expectTypeOf(checksUnknownMethodNamesAreATypeError).toBeFunction();
  });
});
