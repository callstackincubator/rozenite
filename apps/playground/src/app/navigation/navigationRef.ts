import { NavigationContainerRef } from '@react-navigation/native';
import { createRef } from 'react';
import { RootStackParamList } from './types';

// Module-level ref shared between App.tsx (passed to <NavigationContainer
// ref={...}>) and rozenite.dev's dev entry (passed to
// useReactNavigationDevTools({ ref }) and used by the Network Playground
// controls section to navigate without a navigation prop).
//
// React Navigation's own `createNavigationContainerRef<RootStackParamList>()`
// was tried first, but `NavigationContainerRefWithCurrent<RootStackParamList>`
// (its return type) is not assignable to `useReactNavigationDevTools`'s
// `ref: React.RefObject<TNavigationContainerRef | null>`, so this falls back
// to a plain `createRef`, per the migration brief. Even so,
// `useReactNavigationDevTools` never actually infers `TNavigationContainerRef`
// from a route-specific ref — it always compares against the default
// `NavigationContainerRef<any>` and fails the stricter, route-specific
// `preload`/`navigate` overloads. This isn't new: the pre-migration code hit
// the same thing with a `NavigationContainerRef<any>`-typed ref and cast with
// `ref: navigationRef as any` at the call site (see rozenite.dev/index.tsx) —
// this ref stays properly typed for its other consumer, network-controls.ts's
// `navigationRef.current?.navigate(...)`.
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();
