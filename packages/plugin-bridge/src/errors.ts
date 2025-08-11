export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(`Unsupported platform: ${platform}`);
    this.name = 'UnsupportedPlatformError';
  }
}
