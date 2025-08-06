/**
 * Utility function to get the name of a blob. Handles both the direct name property and the data object.
 *
 * ```
 * // node_modules/react-native/Libraries/Blob/Blob.js
 *
 * export type BlobData = {
 *   blobId: string,
 *   offset: number,
 *   size: number,
 *   name?: string,
 *   type?: string,
 *   lastModified?: number,
 *   __collector?: ?BlobCollector,
 *   ...
 * };
 *
 * get data(): BlobData {
 *   if (!this._data) {
 *     throw new Error('Blob has been closed and is no longer available');
 *   }
 *
 *   return this._data;
 * }
 *
 * get size(): number {
 *   return this.data.size;
 * }
 *
 * get type(): string {
 *   return this.data.type || '';
 * }
 * ```
 */
export function getBlobName(blob: any): string | undefined {
  if (typeof blob?.name === 'string') {
    return blob.name;
  }

  if (blob?.data && typeof blob.data.name === 'string') {
    return blob.data.name;
  }

  return undefined;
}
