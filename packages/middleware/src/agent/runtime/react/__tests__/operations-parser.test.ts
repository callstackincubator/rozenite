import { describe, expect, it } from 'vitest';
import {
  parseTreeOperations,
  TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
} from '../operations-parser.js';

/** `[rendererId, rootId, stringTableSize, ...operations]` with an empty table. */
const withEmptyStringTable = (...operations: number[]): number[] => [1, 1, 0, ...operations];

describe('parseTreeOperations errors and warnings', () => {
  it('parses an errors-or-warnings update', () => {
    const parsed = parseTreeOperations(
      withEmptyStringTable(TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS, 4, 2, 3),
    );

    expect(parsed?.errorsOrWarnings).toEqual([{ nodeId: 4, errorCount: 2, warningCount: 3 }]);
  });

  it('keeps parsing the operations that follow an update', () => {
    const parsed = parseTreeOperations(
      withEmptyStringTable(
        TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
        4,
        1,
        0,
        TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
        5,
        0,
        2,
      ),
    );

    expect(parsed?.errorsOrWarnings).toEqual([
      { nodeId: 4, errorCount: 1, warningCount: 0 },
      { nodeId: 5, errorCount: 0, warningCount: 2 },
    ]);
  });

  it('drops a malformed update without losing the rest of the batch', () => {
    const parsed = parseTreeOperations(
      withEmptyStringTable(
        TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
        4,
        -1,
        0,
        TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
        5,
        1,
        1,
      ),
    );

    expect(parsed?.errorsOrWarnings).toEqual([{ nodeId: 5, errorCount: 1, warningCount: 1 }]);
  });
});
