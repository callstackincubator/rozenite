import { cn } from '@rozenite/ui';
import { isElectron, isMac } from './platform';

/**
 * Classes for whatever sits in the window's top-left corner — `Shell`'s
 * `Sidebar.Header`, or this app's own pre-connection header — so it also
 * doubles as the window's drag handle and, on macOS, leaves room above its
 * content for the traffic lights instead of overlapping it. Deliberately
 * scoped to that one corner rather than a full-width strip:
 * Codex/Claude Code-style layouts reserve space for the traffic lights
 * only where the sidebar already has a header, and let everything else
 * (including the divider between sidebar and content) run flush to the
 * window's top edge instead of stopping short of it.
 *
 * Windows/Linux window controls sit at the top *right* instead, so they
 * never overlap this top-left corner — only the drag region is needed
 * there, with no extra space to reserve.
 */
export const getTitleBarRegionClassName = (): string | undefined => {
  if (!isElectron()) {
    return undefined;
  }

  if (!isMac()) {
    return '[-webkit-app-region:drag]';
  }

  // `Sidebar.Header`'s own default is `h-12` (48px) with `items-center`
  // (kept, not overridden here): grow the box by a 28px strip reserved for
  // the traffic lights (48 + 28 = 76) and pad only that strip away on top,
  // so `items-center` centers the logo within the remaining 48px exactly
  // as it did before — just shifted down by the 28px pad — instead of
  // pinning it to the top of that space and dumping all the header's
  // normal vertical slack below it.
  //
  // These must stay literal — Tailwind's build-time scanner matches class
  // names as literal text in the source, so building them from a shared
  // constant (e.g. `` `pt-[${N}px]` ``) would make them invisible to it
  // and silently drop the rules. The 28px also must stay in sync with
  // `trafficLightPosition.y` in `packages/electron-app/src/main.js`, which
  // centers the lights within the same strip.
  return cn('[-webkit-app-region:drag]', 'h-[76px]', 'pt-[28px]');
};

/**
 * A corner-sized, invisible drag handle for screens with no `Sidebar` to
 * carry `getTitleBarRegionClassName()` itself (the pre-connection loading
 * state, the "wrong URL" error screen) — otherwise, with the title bar
 * hidden and nothing in the page marked as a drag region, the window
 * couldn't be moved at all on those screens. `fixed` rather than laid out
 * in flow, so it doesn't reserve any visible space.
 */
export function WindowDragHandle() {
  const regionClassName = getTitleBarRegionClassName();

  if (!regionClassName) {
    return null;
  }

  return <div aria-hidden className={cn('fixed top-0 left-0 z-50 h-12 w-20', regionClassName)} />;
}
