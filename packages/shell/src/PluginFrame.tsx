import { useState } from 'react';
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
 */
export function PluginFrame({ plugin, panel, isActive, frameRef }: PluginFrameProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    // `hidden` lives here rather than on the iframe itself, so the loading
    // cover below can be a plain sibling instead of needing its own
    // visibility bookkeeping.
    <div className="relative h-full w-full" hidden={!isActive}>
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
