import { useState } from 'react';
import { cn } from '@rozenite/ui';
import type { ShellPanel, ShellPlugin } from './types';

export type PluginFrameProps = {
  plugin: ShellPlugin;
  panel: ShellPanel;
  /** Whether this is the panel currently selected in the sidebar — panels
   * for other, still-mounted plugins stay in the DOM (see the comment
   * above this component's caller) but hidden. */
  isActive: boolean;
  /** Registers/unregisters this panel's iframe element with the caller
   * (keyed by `panel.id`, e.g. for message forwarding) as it mounts/unmounts. */
  frameRef: (frame: HTMLIFrameElement | null) => void;
};

/**
 * One plugin panel's iframe, plus the loading state that hides its own
 * blank-white startup flash. `panel.source` is that plugin's own bundle —
 * a separate document this app has no control over — so this can only
 * mask the flash (a themed cover shown until the iframe fires `load`),
 * not prevent it upstream.
 *
 * Inactive panels are hidden with `visibility`, never `display: none`.
 * Chromium reports `prefers-color-scheme: dark` as `false` inside a frame
 * that isn't being rendered, so a panel booting under `display: none`
 * resolves its theme against a light preference and — since
 * `PluginThemeProvider` reads that preference once, at mount — stays light
 * for the rest of the session even after it's selected. Every panel except
 * whichever one happens to be active on load would come up light against a
 * dark shell.
 */
export function PluginFrame({ plugin, panel, isActive, frameRef }: PluginFrameProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      // Stacked rather than laid out in flow, since with `visibility` doing
      // the hiding every panel still occupies space. The active one is
      // raised above the rest so it, and only it, takes pointer input.
      className={cn('absolute inset-0', isActive ? 'visible z-10' : 'invisible z-0')}
      // Keeps inactive panels out of the tab order and off the
      // accessibility tree, which `display: none` used to do for free.
      inert={!isActive}
      aria-hidden={!isActive}
    >
      <iframe
        ref={frameRef}
        title={`${plugin.name}: ${panel.name}`}
        src={panel.source}
        onLoad={() => setIsLoaded(true)}
      />
      {!isLoaded && <div aria-hidden className="absolute inset-0 bg-background" />}
    </div>
  );
}
