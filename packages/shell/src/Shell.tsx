import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  Button,
  EmptyState,
  PluginShell,
  Sidebar,
  Split,
  type SplitPaneHandle,
} from '@rozenite/ui';
import compactLogo from '../../../website/src/public/logo.svg';
import lightLogo from '../../../website/src/public/logo-light.svg';
import darkLogo from '../../../website/src/public/logo-dark.svg';
import { getInitialSelection, type ShellSelection } from './selection';
import { NewVersionFooter } from './NewVersionFooter';
import { WelcomeDialog } from './WelcomeDialog';
import type { ShellConfiguration, ShellPanel, ShellPlugin } from './types';

const SHELL_CONFIGURATION_TYPE = 'rozenite-shell-configuration';
const COLLAPSED_SIDEBAR_WIDTH = 48;
const EXPANDED_SIDEBAR_WIDTH = 224;
const SIDEBAR_SNAP_POINT = (COLLAPSED_SIDEBAR_WIDTH + EXPANDED_SIDEBAR_WIDTH) / 2;
export function Shell({ plugins, destroyOnDetachPlugins, runtimeVersion }: ShellConfiguration) {
  const [selection, setSelection] = useState<ShellSelection>(() => getInitialSelection(plugins));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const contentFrames = useRef(new Map<string, HTMLIFrameElement>());
  const sidebarPanel = useRef<SplitPaneHandle>(null);

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
    const forwardToPanels = (event: MessageEvent) => {
      if (event.source === window.parent) {
        for (const frame of contentFrames.current.values()) {
          frame.contentWindow?.postMessage(event.data, '*');
        }
        return;
      }

      if (
        [...contentFrames.current.values()].some((frame) => event.source === frame.contentWindow)
      ) {
        window.parent.postMessage(event.data, '*');
      }
    };

    window.addEventListener('message', forwardToPanels);
    return () => window.removeEventListener('message', forwardToPanels);
  }, []);

  const activePlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selection?.pluginId) ?? null,
    [plugins, selection?.pluginId],
  );
  const activePanel = activePlugin?.panels.find((panel) => panel.id === selection?.panelId);
  const destroyedPluginIds = new Set(destroyOnDetachPlugins);
  const panels = plugins.flatMap((plugin) => plugin.panels.map((panel) => ({ plugin, panel })));
  const selectPanel = (plugin: ShellPlugin, panel: ShellPanel) => {
    setSelection({ pluginId: plugin.id, panelId: panel.id });
  };
  const resizeSidebar = (collapsed: boolean) => {
    sidebarPanel.current?.resize(
      `${collapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH}px`,
    );
    setIsSidebarCollapsed(collapsed);
  };
  const snapSidebar = () => {
    const size = sidebarPanel.current?.getSize().inPixels;

    if (size === undefined) {
      return;
    }

    resizeSidebar(size < SIDEBAR_SNAP_POINT);
  };

  if (!activePlugin || !activePanel) {
    return (
      <PluginShell>
        <WelcomeDialog runtimeVersion={runtimeVersion} />
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
      <WelcomeDialog runtimeVersion={runtimeVersion} />
      <PluginShell.Body className="flex-row overflow-hidden">
        <Split
          direction="horizontal"
          onLayoutChanged={(_, { isUserInteraction }) => {
            if (isUserInteraction) {
              snapSidebar();
            }
          }}
        >
          <Split.Pane
            id="shell-sidebar"
            panelRef={sidebarPanel}
            defaultSize={`${EXPANDED_SIDEBAR_WIDTH}px`}
            minSize={`${COLLAPSED_SIDEBAR_WIDTH}px`}
            maxSize={`${EXPANDED_SIDEBAR_WIDTH}px`}
          >
            <Sidebar
              aria-label="Rozenite panels"
              className="h-full w-full gap-0 overflow-hidden border-r-0 p-0"
            >
              <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-sidebar-border bg-sidebar px-3">
                {isSidebarCollapsed ? (
                  <img src={compactLogo} alt="Rozenite" className="h-6 w-6" />
                ) : (
                  <>
                    <img src={lightLogo} alt="Rozenite" className="h-6 w-auto dark:hidden" />
                    <img src={darkLogo} alt="Rozenite" className="hidden h-6 w-auto dark:block" />
                  </>
                )}
              </header>
              {!isSidebarCollapsed && (
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
              )}
              <footer className="mt-auto flex shrink-0 gap-1 border-t border-sidebar-border p-2">
                {!isSidebarCollapsed && <NewVersionFooter currentVersion={runtimeVersion} />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={() => resizeSidebar(!isSidebarCollapsed)}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </footer>
            </Sidebar>
          </Split.Pane>
          <Split.Handle className="bg-sidebar-border" />
          <Split.Pane>
            <div className="h-full min-w-0">
              {panels.map(({ plugin, panel }) => {
                const isActive = panel.id === activePanel.id;
                const shouldDestroy = destroyedPluginIds.has(plugin.id);

                if (shouldDestroy && !isActive) {
                  return null;
                }

                return (
                  <iframe
                    key={panel.id}
                    ref={(frame) => {
                      if (frame) {
                        contentFrames.current.set(panel.id, frame);
                      } else {
                        contentFrames.current.delete(panel.id);
                      }
                    }}
                    hidden={!isActive}
                    title={`${plugin.name}: ${panel.name}`}
                    src={panel.source}
                  />
                );
              })}
            </div>
          </Split.Pane>
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
}

export { SHELL_CONFIGURATION_TYPE };
