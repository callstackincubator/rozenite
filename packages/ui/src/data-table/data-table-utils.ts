/**
 * Returns a new array with a single row's field replaced, for committing an
 * inline cell edit without mutating the original data.
 */
export function updateCellValue<TRow extends Record<string, unknown>>(
  data: TRow[],
  rowIndex: number,
  columnId: string,
  value: unknown,
): TRow[] {
  return data.map((row, index) =>
    index === rowIndex ? { ...row, [columnId]: value } : row,
  );
}
