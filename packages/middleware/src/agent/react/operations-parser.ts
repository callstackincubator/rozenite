export const TREE_OPERATION_ADD = 1;
export const TREE_OPERATION_REMOVE = 2;
export const TREE_OPERATION_REORDER_CHILDREN = 3;
export const TREE_OPERATION_UPDATE_TREE_BASE_DURATION = 4;
export const TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS = 5;
export const TREE_OPERATION_REMOVE_ROOT = 6;
export const TREE_OPERATION_SET_SUBTREE_MODE = 7;

export const SUSPENSE_TREE_OPERATION_ADD = 8;
export const SUSPENSE_TREE_OPERATION_REMOVE = 9;
export const SUSPENSE_TREE_OPERATION_REORDER_CHILDREN = 10;
export const SUSPENSE_TREE_OPERATION_RESIZE = 11;
export const SUSPENSE_TREE_OPERATION_SUSPENDERS = 12;
export const TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE = 13;

export const ELEMENT_TYPE_CLASS = 1;
export const ELEMENT_TYPE_FUNCTION = 5;
export const ELEMENT_TYPE_FORWARD_REF = 6;
export const ELEMENT_TYPE_HOST = 7;
export const ELEMENT_TYPE_MEMO = 8;
export const ELEMENT_TYPE_PROFILER = 10;
export const ELEMENT_TYPE_ROOT = 11;
export const ELEMENT_TYPE_SUSPENSE = 12;

export type ParsedAddNode = {
  nodeId: number;
  parentId?: number;
  rendererId: number;
  elementType: number;
  displayName: string;
  key?: string;
  isRoot: boolean;
};

export type ParsedTreeOperations = {
  rendererId: number;
  added: ParsedAddNode[];
  removedNodeIds: number[];
  removedRootIds: number[];
  reorderedChildren: Array<{ nodeId: number; childIds: number[] }>;
  usesExtendedAddFormat: boolean;
};

const isInteger = (value: unknown): value is number => {
  return Number.isInteger(value);
};

const readStringTable = (
  operations: number[],
  startIndex: number,
): { table: Array<string | null>; nextIndex: number } | null => {
  let index = startIndex;
  const table: Array<string | null> = [null];

  if (!isInteger(operations[index]) || operations[index] < 0) {
    return null;
  }

  const stringTableSize = operations[index++];
  const stringTableEnd = index + stringTableSize;
  if (stringTableEnd > operations.length) {
    return null;
  }

  while (index < stringTableEnd) {
    const length = operations[index++];
    if (!isInteger(length) || length < 0) {
      return null;
    }

    if (index + length > stringTableEnd) {
      return null;
    }

    let value = '';
    for (let j = 0; j < length; j += 1) {
      value += String.fromCodePoint(operations[index++]);
    }

    table.push(value);
  }

  return {
    table,
    nextIndex: index,
  };
};

const readStringById = (table: Array<string | null>, id: number): string | null => {
  if (!isInteger(id) || id <= 0 || id >= table.length) {
    return null;
  }

  return table[id] ?? null;
};

const skipRects = (operations: number[], startIndex: number): number | null => {
  if (!isInteger(operations[startIndex])) {
    return null;
  }

  const count = operations[startIndex];
  if (count === -1) {
    return startIndex + 1;
  }

  if (count < 0) {
    return null;
  }

  const nextIndex = startIndex + 1 + count * 4;
  if (nextIndex > operations.length) {
    return null;
  }

  return nextIndex;
};

export const parseTreeOperations = (
  operations: unknown,
  options?: { extendedAddFormat?: boolean },
): ParsedTreeOperations | null => {
  if (!Array.isArray(operations) || operations.length < 3) {
    return null;
  }

  const numericOps = operations
    .filter((value): value is number => Number.isFinite(value))
    .map((value) => Number(value));
  if (numericOps.length !== operations.length) {
    return null;
  }

  const rendererId = isInteger(numericOps[0]) ? numericOps[0] : 0;
  const stringTable = readStringTable(numericOps, 2);
  if (!stringTable) {
    return null;
  }

  const parsed: ParsedTreeOperations = {
    rendererId,
    added: [],
    removedNodeIds: [],
    removedRootIds: [],
    reorderedChildren: [],
    usesExtendedAddFormat: options?.extendedAddFormat === true,
  };

  let index = stringTable.nextIndex;
  while (index < numericOps.length) {
    const operation = numericOps[index];

    switch (operation) {
      case TREE_OPERATION_ADD: {
        if (index + 2 >= numericOps.length) {
          return parsed;
        }

        const nodeId = numericOps[index + 1];
        const elementType = numericOps[index + 2];
        index += 3;

        if (!isInteger(nodeId) || !isInteger(elementType)) {
          return parsed;
        }

        if (elementType === ELEMENT_TYPE_ROOT) {
          if (index + 4 > numericOps.length) {
            return parsed;
          }

          index += 4;
          parsed.added.push({
            nodeId,
            rendererId,
            elementType,
            displayName: 'Root',
            isRoot: true,
          });
          break;
        }

        if (index + 4 > numericOps.length) {
          return parsed;
        }

        const parentId = numericOps[index++];
        index += 1; // ownerID
        const displayNameStringId = numericOps[index++];
        const keyStringId = numericOps[index++];

        if (parsed.usesExtendedAddFormat) {
          if (index >= numericOps.length) {
            return parsed;
          }
          index += 1; // namePropStringID
        }

        const parsedParentId = isInteger(parentId) && parentId !== 0 ? parentId : undefined;
        const rawDisplayName = readStringById(stringTable.table, displayNameStringId);
        const displayName = rawDisplayName
          || (elementType === ELEMENT_TYPE_HOST ? 'HostComponent' : `Node ${nodeId}`);
        const key = readStringById(stringTable.table, keyStringId) ?? undefined;

        parsed.added.push({
          nodeId,
          parentId: parsedParentId,
          rendererId,
          elementType,
          displayName,
          ...(key !== undefined ? { key } : {}),
          isRoot: parsedParentId === undefined,
        });
        break;
      }

      case TREE_OPERATION_REMOVE: {
        if (index + 1 >= numericOps.length || !isInteger(numericOps[index + 1])) {
          return parsed;
        }

        const count = numericOps[index + 1];
        if (count < 0 || index + 2 + count > numericOps.length) {
          return parsed;
        }

        for (let j = 0; j < count; j += 1) {
          const removedId = numericOps[index + 2 + j];
          if (isInteger(removedId)) {
            parsed.removedNodeIds.push(removedId);
          }
        }

        index += 2 + count;
        break;
      }

      case TREE_OPERATION_REORDER_CHILDREN: {
        if (index + 2 >= numericOps.length) {
          return parsed;
        }

        const nodeId = numericOps[index + 1];
        const childCount = numericOps[index + 2];
        if (!isInteger(nodeId) || !isInteger(childCount) || childCount < 0) {
          return parsed;
        }

        if (index + 3 + childCount > numericOps.length) {
          return parsed;
        }

        const childIds: number[] = [];
        for (let j = 0; j < childCount; j += 1) {
          const childId = numericOps[index + 3 + j];
          if (isInteger(childId)) {
            childIds.push(childId);
          }
        }

        parsed.reorderedChildren.push({
          nodeId,
          childIds,
        });

        index += 3 + childCount;
        break;
      }

      case TREE_OPERATION_REMOVE_ROOT: {
        const rootId = numericOps[index + 1];
        if (isInteger(rootId)) {
          parsed.removedRootIds.push(rootId);
        }
        index += 2;
        break;
      }

      case TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        index += 3;
        break;

      case TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        index += 4;
        break;

      case TREE_OPERATION_SET_SUBTREE_MODE:
        index += 3;
        break;

      case SUSPENSE_TREE_OPERATION_ADD: {
        parsed.usesExtendedAddFormat = true;
        const nextIndex = skipRects(numericOps, index + 5);
        if (nextIndex === null) {
          return parsed;
        }
        index = nextIndex;
        break;
      }

      case SUSPENSE_TREE_OPERATION_REMOVE: {
        parsed.usesExtendedAddFormat = true;
        const count = numericOps[index + 1];
        if (!isInteger(count) || count < 0) {
          return parsed;
        }
        index += 2 + count;
        break;
      }

      case SUSPENSE_TREE_OPERATION_REORDER_CHILDREN: {
        parsed.usesExtendedAddFormat = true;
        const childCount = numericOps[index + 2];
        if (!isInteger(childCount) || childCount < 0) {
          return parsed;
        }
        index += 3 + childCount;
        break;
      }

      case SUSPENSE_TREE_OPERATION_RESIZE: {
        parsed.usesExtendedAddFormat = true;
        const nextIndex = skipRects(numericOps, index + 2);
        if (nextIndex === null) {
          return parsed;
        }
        index = nextIndex;
        break;
      }

      case SUSPENSE_TREE_OPERATION_SUSPENDERS: {
        parsed.usesExtendedAddFormat = true;
        const count = numericOps[index + 1];
        if (!isInteger(count) || count < 0) {
          return parsed;
        }
        index += 2 + count * 4;
        break;
      }

      case TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE:
        parsed.usesExtendedAddFormat = true;
        index += 2;
        break;

      default:
        index += 1;
        break;
    }
  }

  return parsed;
};

export const toReactElementTypeLabel = (elementType: number): string => {
  switch (elementType) {
    case ELEMENT_TYPE_CLASS:
      return 'class';
    case ELEMENT_TYPE_FUNCTION:
      return 'function';
    case ELEMENT_TYPE_FORWARD_REF:
      return 'forward-ref';
    case ELEMENT_TYPE_HOST:
      return 'host';
    case ELEMENT_TYPE_MEMO:
      return 'memo';
    case ELEMENT_TYPE_PROFILER:
      return 'profiler';
    case ELEMENT_TYPE_ROOT:
      return 'root';
    case ELEMENT_TYPE_SUSPENSE:
      return 'suspense';
    default:
      return 'unknown';
  }
};
