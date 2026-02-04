declare module 'ws' {
  export default class WebSocket {
    static readonly OPEN: number;
    readyState: number;

    constructor(url: string);

    once(event: string, listener: (...args: unknown[]) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
    send(payload: string, cb?: (error?: Error) => void): void;
    close(): void;
  }
}
