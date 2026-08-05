import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, PluginShell, Sidebar } from '@rozenite/ui';
import lightLogo from '../../../website/src/public/logo-light.svg';
import darkLogo from '../../../website/src/public/logo-dark.svg';
import { getInitialSelection, type ShellSelection } from './selection';
import { NewVersionFooter } from './NewVersionFooter';
import type { ShellConfiguration, ShellPanel, ShellPlugin } from './types';

const SHELL_CONFIGURATION_TYPE = 'rozenite-shell-configuration';

export function Shell({ plugins, runtimeVersion }: ShellConfiguration) {
  const [selection, setSelection] = useState<ShellSelection>(() =>
    getInitialSelection(plugins),
  );
  const contentFrame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setSelection((current) => {
      if (
        current &&
        plugins.some(
          (plugin) =>
            plugin.id === current.pluginId &&
            plugin.panels.some((panel) => panel.id === current.panelId),
        )
      ) {
        return current;
      }

      return getInitialSelection(plugins);
    });
  }, [plugins]);

  useEffect(() => {
    const forwardToActivePanel = (event: MessageEvent) => {
      const activeFrame = contentFrame.current;

      if (event.source === window.parent) {
        activeFrame?.contentWindow?.postMessage(event.data, '*');
        return;
      }

      if (event.source === activeFrame?.contentWindow) {
        window.parent.postMessage(event.data, '*');
      }
    };

    window.addEventListener('message', forwardToActivePanel);
    return () => window.removeEventListener('message', forwardToActivePanel);
  }, []);

  const activePlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selection?.pluginId) ?? null,
    [plugins, selection?.pluginId],
  );
  const activePanel = activePlugin?.panels.find(
    (panel) => panel.id === selection?.panelId,
  );
  const selectPanel = (plugin: ShellPlugin, panel: ShellPanel) => {
    setSelection({ pluginId: plugin.id, panelId: panel.id });
  };

  if (!activePlugin || !activePanel) {
    return (
      <PluginShell>
        <PluginShell.Body className="items-center justify-center">
          <EmptyState
            title="No Rozenite plugins available"
            description="Install a Rozenite plugin and reconnect DevTools to inspect it here."
          />
        </PluginShell.Body>
      </PluginShell>
    );
  }

  return (
    <PluginShell>
      <PluginShell.Body className="flex-row overflow-hidden">
        <Sidebar
          aria-label="Rozenite panels"
          className="w-56 shrink-0 gap-0 p-0"
        >
          <header className="sticky top-0 z-10 shrink-0 border-b border-sidebar-border bg-sidebar px-3 py-3">
            <img
              src={lightLogo}
              alt="Rozenite"
              className="h-6 w-auto dark:hidden"
            />
            <img
              src={darkLogo}
              alt="Rozenite"
              className="hidden h-6 w-auto dark:block"
            />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-3">
              {plugins.map((plugin) => {
                if (plugin.panels.length === 0) {
                  return null;
                }

                if (plugin.panels.length === 1) {
                  const [panel] = plugin.panels;

                  return (
                    <Sidebar.Item
                      key={panel.id}
                      selected={panel.id === activePanel.id}
                      onClick={() => selectPanel(plugin, panel)}
                    >
                      {panel.name}
                    </Sidebar.Item>
                  );
                }

                return (
                  <Sidebar.Group key={plugin.id} label={plugin.name}>
                    {plugin.panels.map((panel) => (
                      <Sidebar.Item
                        key={panel.id}
                        selected={panel.id === activePanel.id}
                        onClick={() => selectPanel(plugin, panel)}
                      >
                        {panel.name}
                      </Sidebar.Item>
                    ))}
                  </Sidebar.Group>
                );
              })}
            </div>
          </div>
          <NewVersionFooter currentVersion={runtimeVersion} />
        </Sidebar>
        <div className="min-w-0 flex-1">
          <iframe
            key={`${activePlugin.id}:${activePanel.id}`}
            ref={contentFrame}
            title={`${activePlugin.name}: ${activePanel.name}`}
            src={activePanel.source}
          />
        </div>
      </PluginShell.Body>
    </PluginShell>
  );
}

export { SHELL_CONFIGURATION_TYPE };
