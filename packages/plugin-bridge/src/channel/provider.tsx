import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Channel } from './types';

/**
 * Which side of the protocol a subtree stands in for. Only the device side
 * announces itself with the `plugin-mounted` lifecycle message, so a test
 * rendering panel code needs a way to say so without setting the
 * process-wide `__ROZENITE_PANEL__` global.
 */
export type RozeniteClientRole = 'device' | 'panel';

export type RozeniteChannelContextValue = {
  channel: Channel;
  role?: RozeniteClientRole;
};

const RozeniteChannelContext = createContext<RozeniteChannelContextValue | null>(null);

export type RozeniteChannelProviderProps = RozeniteChannelContextValue & {
  children?: ReactNode;
};

/**
 * Supplies a `Channel` to every `useRozeniteDevToolsClient()` below it,
 * instead of the one `getChannel()` would resolve from the environment.
 *
 * There is no provider in production — a plugin's panel and its
 * `react-native.ts` entry render without one, and resolve a real channel as
 * before. This exists so `@rozenite/testing` can render a plugin's real,
 * unmodified components (with React Testing Library or any renderer) against
 * an in-memory channel, without the components needing a `channel` prop
 * threaded through them purely for tests.
 *
 * Prefer `@rozenite/testing`'s re-export, which is where this is documented.
 */
export const RozeniteChannelProvider = ({
  channel,
  role,
  children,
}: RozeniteChannelProviderProps) => {
  const value = useMemo(() => ({ channel, role }), [channel, role]);

  return (
    <RozeniteChannelContext.Provider value={value}>{children}</RozeniteChannelContext.Provider>
  );
};

export const useRozeniteChannelContext = (): RozeniteChannelContextValue | null => {
  return useContext(RozeniteChannelContext);
};
