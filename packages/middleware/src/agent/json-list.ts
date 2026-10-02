/**
 * One entry of a dev server's `GET /json/list`, as Rozenite's target
 * discovery (`metro-discovery.ts`) reads it. Metro's inspector proxy and the
 * Lynx dev server (`@rozenite/lynx/rspeedy`) both serve this shape.
 *
 * This is the consumer's view: it only requires what discovery cannot do
 * without, and treats `reactNative` as optional because a legacy page may
 * omit it. A producer that always sends more can narrow it (see
 * `packages/lynx/src/rspeedy/server/json-list.ts`).
 */
export type JsonPageDescription = {
  id: string;
  title: string;
  description: string;
  appId: string;
  type?: string;
  deviceName: string;
  webSocketDebuggerUrl: string;
  reactNative?: {
    logicalDeviceId?: string;
    capabilities?: {
      prefersFuseboxFrontend?: boolean;
    };
  };
};
