import { describe, expect, it } from 'vitest';
import { parseTreeOperations } from '../operations-parser.js';

const encodeString = (value: string): number[] => {
  const codePoints = [...value].map((char) => char.codePointAt(0) || 0);
  return [codePoints.length, ...codePoints];
};

const createOperationsPayload = (
  operations: number[],
  strings: string[] = [],
): number[] => {
  const stringTable = strings.flatMap((value) => encodeString(value));
  return [1, 1, stringTable.length, ...stringTable, ...operations];
};

describe('parseTreeOperations', () => {
  it('parses add/reorder/remove operations', () => {
    const payload = createOperationsPayload([
      1, 1, 11, 0, 0, 0, 0,
      1, 2, 5, 1, 0, 1, 2,
      1, 3, 5, 1, 0, 3, 0,
      3, 1, 2, 3, 2,
      2, 1, 3,
    ], ['Leaf', 'leaf-key', 'Another']);

    const parsed = parseTreeOperations(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.added.map((node) => node.nodeId)).toEqual([1, 2, 3]);
    expect(parsed?.reorderedChildren).toEqual([{ nodeId: 1, childIds: [3, 2] }]);
    expect(parsed?.removedNodeIds).toEqual([3]);
  });

  it('supports extended add format after suspense operations', () => {
    const payload = createOperationsPayload([
      8, 10, 1, 1, 0, -1,
      1, 20, 5, 10, 0, 1, 0, 0,
    ], ['ExtendedNode']);

    const parsed = parseTreeOperations(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.usesExtendedAddFormat).toBe(true);
    expect(parsed?.added).toEqual([
      {
        nodeId: 20,
        parentId: 10,
        rendererId: 1,
        elementType: 5,
        displayName: 'ExtendedNode',
        isRoot: false,
      },
    ]);
  });

  it('ignores unknown opcodes without crashing', () => {
    const payload = createOperationsPayload([
      123,
      1, 1, 11, 0, 0, 0, 0,
    ]);

    const parsed = parseTreeOperations(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.added).toHaveLength(1);
    expect(parsed?.added[0].nodeId).toBe(1);
  });
});
