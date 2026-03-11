export type PaginationErrorCode =
  | 'PAGINATION_INVALID_CURSOR'
  | 'PAGINATION_CURSOR_MISMATCH';

export class PaginationError extends Error {
  code: PaginationErrorCode;

  constructor(code: PaginationErrorCode, message: string) {
    super(message);
    this.name = 'PaginationError';
    this.code = code;
  }
}

export const isPaginationError = (error: unknown): error is PaginationError => {
  return error instanceof PaginationError;
};
