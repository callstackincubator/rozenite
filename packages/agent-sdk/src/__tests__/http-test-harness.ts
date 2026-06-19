import { afterEach, vi } from 'vitest';

export type MockHttpRequest = {
  body: unknown;
  headers?: Record<string, string | number>;
  method: string;
  pathname: string;
};

export type MockHttpResult = {
  error?: unknown;
  payload?: unknown;
  rawBody?: string;
  statusCode?: number;
};

const httpTestHarnessState = vi.hoisted(() => ({
  requestHandler: vi.fn<(request: MockHttpRequest) => MockHttpResult | Promise<MockHttpResult>>(),
}));

export const httpTestHarness = {
  requestHandler: httpTestHarnessState.requestHandler,
};

vi.mock('node:http', () => ({
  request: (
    url: URL,
    options: {
      method?: string;
      headers?: Record<string, string | number>;
    },
    callback: (
      response: {
        statusCode?: number;
        setEncoding: () => void;
        on: (event: string, handler: (chunk?: unknown) => void) => void;
      },
    ) => void,
  ) => {
    class MockEmitter {
      private readonly listeners = new Map<
        string,
        Array<(payload?: unknown) => void>
      >();

      on(event: string, handler: (payload?: unknown) => void) {
        const existing = this.listeners.get(event) || [];
        existing.push(handler);
        this.listeners.set(event, existing);
      }

      once(event: string, handler: (payload?: unknown) => void) {
        const wrapped = (payload?: unknown) => {
          this.off(event, wrapped);
          handler(payload);
        };
        this.on(event, wrapped);
      }

      off(event: string, handler: (payload?: unknown) => void) {
        const existing = this.listeners.get(event) || [];
        this.listeners.set(
          event,
          existing.filter((candidate) => candidate !== handler),
        );
      }

      emit(event: string, payload?: unknown) {
        const existing = this.listeners.get(event) || [];
        for (const handler of existing) {
          handler(payload);
        }
      }
    }

    class MockRequest extends MockEmitter {
      private readonly chunks: Uint8Array[] = [];

      write(chunk: string | Uint8Array) {
        if (typeof chunk === 'string') {
          this.chunks.push(new Uint8Array(Buffer.from(chunk)));
          return;
        }

        this.chunks.push(chunk);
      }

      end() {
        queueMicrotask(async () => {
          try {
            const result = await httpTestHarnessState.requestHandler({
              body:
                this.chunks.length > 0
                  ? JSON.parse(Buffer.concat(this.chunks).toString('utf8'))
                  : undefined,
              headers: options.headers,
              method: options.method ?? 'GET',
              pathname: url.pathname,
            });

            if (result?.error) {
              this.emit('error', result.error);
              return;
            }

            const response = new MockEmitter() as MockEmitter & {
              statusCode?: number;
              setEncoding: () => void;
            };
            response.statusCode = result?.statusCode ?? 200;
            response.setEncoding = () => {};

            callback(response);

            if (result?.rawBody !== undefined) {
              response.emit('data', result.rawBody);
            } else if (result?.payload !== undefined) {
              response.emit('data', JSON.stringify(result.payload));
            }

            response.emit('end');
          } catch (error) {
            this.emit('error', error);
          }
        });
      }
    }

    return new MockRequest();
  },
}));

export const mockUnknownRoute = (): MockHttpResult => ({
  statusCode: 404,
  payload: {
    ok: false,
    error: { message: 'Unknown route' },
  },
});

afterEach(() => {
  httpTestHarnessState.requestHandler.mockReset();
});
