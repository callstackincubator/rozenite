export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(`Unsupported platform: ${platform}`);
    this.name = 'UnsupportedPlatformError';
  }
}

export class MissingRozeniteForWebError extends Error {
  constructor() {
    super(
      'Rozenite for web is not configured. A separate integration is required for web. Consult Rozenite docs for details.'
    );
    this.name = 'MissingRozeniteForWebError';
  }
}
