/**
 * Extracts form data parts from a FormData object.
 * Handles both the standard FormData API and the React Native FormData format.
 *
 * ```
 * // node_modules/react-native/Libraries/Network/FormData.js
 *
 * class FormData {
 *   _parts: Array<FormDataNameValuePair>;
 *
 *   constructor() {
 *     this._parts = [];
 *   }
 *
 * ...
 * ```
 */
export function getFormDataEntries(formData: any): [string, unknown][] {
  if (!formData || typeof formData !== 'object') {
    return [];
  }

  if (typeof formData.entries === 'function') {
    return formData.entries();
  }

  if (Array.isArray(formData._parts)) {
    return formData._parts;
  }

  return [];
}
