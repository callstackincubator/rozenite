/**
 * Combines multiple HTTP header values according to RFC 7230 Section 3.2.2
 *
 * Per RFC 7230 Section 3.2.2: "A recipient MAY combine multiple header fields
 * with the same field name into one 'field-name: field-value' pair, without
 * changing the semantics of the message, by appending each subsequent field
 * value to the combined field value in order, separated by a comma."
 *
 * @see https://tools.ietf.org/html/rfc7230#section-3.2.2
 */
export function getHttpHeaderValueAsString(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}
