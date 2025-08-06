export function safeStringify(data: unknown): string {
  try {
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch (error) {
    return String(data);
  }
}
