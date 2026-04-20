import {
  type AgentToolDescriptor,
  type InferAgentToolArgs,
  type InferAgentToolResult,
} from '@rozenite/agent-shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  controlsTools,
  type ControlsListSectionsResult,
} from '@rozenite/controls-plugin/sdk';
import {
  fileSystemTools,
  type FileSystemListRootsResult,
} from '@rozenite/file-system-plugin/sdk';
import {
  mmkvTools,
  type MMKVReadEntryResult,
} from '@rozenite/mmkv-plugin/sdk';
import {
  networkActivityTools,
  type NetworkActivityListRequestsResult,
} from '@rozenite/network-activity-plugin/sdk';
import { reactNavigationTools } from '@rozenite/react-navigation-plugin/sdk';
import { reduxDevToolsTools } from '@rozenite/redux-devtools-plugin/sdk';
import {
  storageTools,
  type StorageReadEntryResult,
} from '@rozenite/storage-plugin/sdk';
import {
  tanstackQueryTools,
  type TanStackQueryListQueriesResult,
} from '@rozenite/tanstack-query-plugin/sdk';

type DescriptorCallTuple<
  TDescriptor extends AgentToolDescriptor<unknown, unknown>,
> = [InferAgentToolArgs<TDescriptor>] extends [undefined]
  ? [args?: InferAgentToolArgs<TDescriptor>]
  : {} extends InferAgentToolArgs<TDescriptor>
    ? [args?: InferAgentToolArgs<TDescriptor>]
    : [args: InferAgentToolArgs<TDescriptor>];

const typedCall = <TDescriptor extends AgentToolDescriptor<unknown, unknown>>(
  _descriptor: TDescriptor,
  ..._args: DescriptorCallTuple<TDescriptor>
): InferAgentToolResult<TDescriptor> => {
  return undefined as InferAgentToolResult<TDescriptor>;
};

describe('official plugin sdk descriptors', () => {
  it('exposes stable domains and tool names for official agent-enabled plugins', () => {
    expect(controlsTools.listSections).toMatchObject({
      domain: '@rozenite/controls-plugin',
      name: 'list-sections',
    });
    expect(fileSystemTools.readTextFile).toMatchObject({
      domain: '@rozenite/file-system-plugin',
      name: 'read-text-file',
    });
    expect(mmkvTools.readEntry).toMatchObject({
      domain: '@rozenite/mmkv-plugin',
      name: 'read-entry',
    });
    expect(networkActivityTools.listRequests).toMatchObject({
      domain: '@rozenite/network-activity-plugin',
      name: 'listRequests',
    });
    expect(reactNavigationTools.navigate).toMatchObject({
      domain: '@rozenite/react-navigation-plugin',
      name: 'navigate',
    });
    expect(reduxDevToolsTools.listStores).toMatchObject({
      domain: '@rozenite/redux-devtools-plugin',
      name: 'list-stores',
    });
    expect(storageTools.readEntry).toMatchObject({
      domain: '@rozenite/storage-plugin',
      name: 'read-entry',
    });
    expect(tanstackQueryTools.listQueries).toMatchObject({
      domain: '@rozenite/tanstack-query-plugin',
      name: 'list-queries',
    });
  });

  it('type-checks representative zero-arg, required-arg, and paginated descriptor calls', () => {
    expectTypeOf(typedCall(controlsTools.listSections)).toEqualTypeOf<
      ControlsListSectionsResult
    >();
    expectTypeOf(typedCall(fileSystemTools.listRoots)).toEqualTypeOf<
      FileSystemListRootsResult
    >();
    expectTypeOf(
      typedCall(storageTools.readEntry, {
        adapterId: 'mmkv',
        storageId: 'user-storage',
        key: 'username',
      }),
    ).toEqualTypeOf<StorageReadEntryResult>();
    expectTypeOf(
      typedCall(mmkvTools.readEntry, {
        storageId: 'user-storage',
        key: 'username',
      }),
    ).toEqualTypeOf<MMKVReadEntryResult>();
    expectTypeOf(
      typedCall(networkActivityTools.listRequests, { limit: 20 }),
    ).toEqualTypeOf<NetworkActivityListRequestsResult>();
    expectTypeOf(
      typedCall(tanstackQueryTools.listQueries, { limit: 20 }),
    ).toEqualTypeOf<TanStackQueryListQueriesResult>();
  });
});
