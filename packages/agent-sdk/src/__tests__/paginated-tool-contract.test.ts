import { describe, expect, it } from 'vitest';
import {
  defineAgentToolDescriptors,
  definePaginatedAgentToolContract,
} from '@rozenite/agent-shared';

type ListArgs = {
  cursor?: string;
};

type ListResult = {
  items: Array<{ id: string; label?: string }>;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};

describe('paginated agent tool contracts', () => {
  it('preserves pagination metadata in public descriptors', () => {
    const list = definePaginatedAgentToolContract<ListArgs, ListResult>({
      name: 'list',
      description: 'List rows',
      readOnly: true,
      idempotent: true,
      inputSchema: { type: 'object', properties: {} },
      pagination: {
        kind: 'cursor',
        fields: ['id', 'label'],
        defaultFields: ['id'],
      },
    });

    expect(defineAgentToolDescriptors('example', { list }).list).toMatchObject({
      domain: 'example',
      name: 'list',
      readOnly: true,
      idempotent: true,
      pagination: {
        kind: 'cursor',
        fields: ['id', 'label'],
        defaultFields: ['id'],
      },
    });
  });

  it('rejects invalid runtime pagination metadata', () => {
    expect(() =>
      definePaginatedAgentToolContract<ListArgs, ListResult>({
        name: 'list',
        description: 'List rows',
        inputSchema: { type: 'object', properties: {} },
        pagination: {
          kind: 'cursor',
          fields: ['id'],
          defaultFields: ['label'],
        },
      }),
    ).toThrow('contain every default field');
  });
});
