import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import {
  Button,
  cn,
  EmptyState,
  IndicatorDot,
  PluginShell,
  Sidebar,
  Split,
  type SplitPaneHandle,
} from '@rozenite/ui';
import compactLogo from '../../../website/src/public/logo.svg';
import lightLogo from '../../../website/src/public/logo-light.svg';
import darkLogo from '../../../website/src/public/logo-dark.svg';
import {
  closePluginsScreen,
  getInitialSelectionState,
  openPluginsScreen,
  reconcileSelection,
  selectPanel as selectPanelSelection,
  type SelectionState,
} from './selection';
import { NewVersionFooter } from './NewVersionFooter';
import { WelcomeDialog } from './WelcomeDialog';
import { getAvailableRuntimeVersion } from './new-version';
import { PluginsScreen } from './plugins/PluginsScreen';
import { useOutdatedPlugins } from './plugins/use-outdated-plugins';
import { getVersionOverridesRevision, subscribeToVersionOverrides } from './npm/registry';
import type { ShellConfiguration, ShellPanel, ShellPlugin } from './types';

const SHELL_CONFIGURATION_TYPE = 'rozenite-shell-configuration';
const COLLAPSED_SIDEBAR_WIDTH = 48;
const EXPANDED_SIDEBAR_WIDTH = 224;
const SIDEBAR_SNAP_POINT = (COLLAPSED_SIDEBAR_WIDTH + EXPANDED_SIDEBAR_WIDTH) / 2;

export function Shell({ plugins, destroyOnDetachPlugins, runtimeVersion }: ShellConfiguration) {
  const [selectionState, setSelectionState] = useState<SelectionState>(() =>
    getInitialSelectionState(plugins),
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [runtimeUpdate, setRuntimeUpdate] = useState<string | null>(null);
  const contentFrames = useRef(new Map<string, HTMLIFrameElement>());
  const sidebarPanel = useRef<SplitPaneHandle>(null);
  const { outdated } = useOutdatedPlugins(plugins);
  const overridesRevision = useSyncExternalStore(
    subscribeToVersionOverrides,
    getVersionOverridesRevision,
  );

  useEffect(() => {
    setSelectionState((current) => reconcileSelection(current, plugins));
  }, [plugins]);

  useEffect(() => {
    if (!runtimeVersion) {
      return;
    }

    let cancelled = false;

    void getAvailableRuntimeVersion(runtimeVersion).then((version) => {
      if (!cancelled) {
        setRuntimeUpdate(version);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [runtimeVersion, overridesRevision]);

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

  const isPluginsScreenOpen = selectionState.selection?.kind === 'plugins';
  const panelSelection =
    selectionState.selection?.kind === 'panel' ? selectionState.selection : null;
  const activePlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === panelSelection?.pluginId) ?? null,
    [plugins, panelSelection?.pluginId],
  );
  const activePanel =
    activePlugin?.panels.find((panel) => panel.id === panelSelection?.panelId) ?? null;
  // Distinct from `activePanel`: while the Plugins screen is open there is no
  // active panel, but the panel selected before the screen opened must stay
  // mounted (just hidden) so a `destroyOnDetach` plugin doesn't lose state on
  // a visit to the screen.
  const retainedPanelId =
    panelSelection?.panelId ??
    (isPluginsScreenOpen ? (selectionState.lastPanel?.panelId ?? null) : null);
  const destroyedPluginIds = new Set(destroyOnDetachPlugins);
  const panels = plugins.flatMap((plugin) => plugin.panels.map((panel) => ({ plugin, panel })));
  const hasPlugins = plugins.length > 0;

  const selectPanel = (plugin: ShellPlugin, panel: ShellPanel) => {
    setSelectionState(selectPanelSelection(plugin.id, panel.id));
  };
  const togglePluginsScreen = () => {
    setSelectionState((current) =>
      current.selection?.kind === 'plugins'
        ? closePluginsScreen(current, plugins)
        : openPluginsScreen(current),
    );
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

  if (!hasPlugins) {
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

  // The cog's dot flags either kind of pending update. Plugin updates are
  // only otherwise surfaced on the Plugins screen; the runtime update link
  // is hidden while the sidebar is collapsed, so its dot keeps that signal
  // reachable too (expanding the sidebar reveals the link again).
  const hasNotice = outdated.size > 0 || runtimeUpdate !== null;

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
              <Sidebar.Header>
                {isSidebarCollapsed ? (
                  <img src={compactLogo} alt="Rozenite" className="h-6 w-6" />
                ) : (
                  <>
                    <img src={lightLogo} alt="Rozenite" className="h-6 w-auto dark:hidden" />
                    <img src={darkLogo} alt="Rozenite" className="hidden h-6 w-auto dark:block" />
                  </>
                )}
              </Sidebar.Header>
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
                            selected={!isPluginsScreenOpen && panel.id === activePanel?.id}
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
                              selected={!isPluginsScreenOpen && panel.id === activePanel?.id}
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
              {/* Collapsed, the rail is too narrow for two icon buttons side by
                  side; stacking keeps the expand button reachable instead of
                  clipping it and stranding the user in the collapsed state. */}
              <Sidebar.Footer className={cn(isSidebarCollapsed && 'flex-col items-center')}>
                {!isSidebarCollapsed && <NewVersionFooter currentVersion={runtimeVersion} />}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    !isSidebarCollapsed && 'ml-auto',
                    isPluginsScreenOpen && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                  aria-label="Plugins"
                  aria-pressed={isPluginsScreenOpen}
                  onClick={togglePluginsScreen}
                  adornment={hasNotice ? <IndicatorDot className="absolute top-1 right-1" /> : null}
                >
                  <Settings />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={() => resizeSidebar(!isSidebarCollapsed)}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </Sidebar.Footer>
            </Sidebar>
          </Split.Pane>
          <Split.Handle className="bg-sidebar-border" />
          <Split.Pane>
            <div className="relative h-full min-w-0">
              {/* Panel iframes stay mounted while the Plugins screen is open;
                  it only covers this area visually so plugin state survives
                  a visit. */}
              <div className={cn('h-full min-w-0', isPluginsScreenOpen && 'hidden')}>
                {panels.map(({ plugin, panel }) => {
                  const isActive = panel.id === activePanel?.id;
                  const isRetained = panel.id === retainedPanelId;
                  const shouldDestroy = destroyedPluginIds.has(plugin.id);

                  if (shouldDestroy && !isRetained) {
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
                {!activePanel && (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState
                      title="No panel selected"
                      description="Select a panel from the sidebar."
                    />
                  </div>
                )}
              </div>
              {/* Flex column so PluginShell.Body's `flex-1` has a parent to
                  resolve against; without it the body's height falls to auto
                  and the screen's ScrollArea grows instead of scrolling. */}
              {isPluginsScreenOpen && (
                <div className="absolute inset-0 flex flex-col">
                  <PluginsScreen
                    plugins={plugins}
                    outdated={outdated}
                    runtimeVersion={runtimeVersion}
                    runtimeUpdate={runtimeUpdate}
                  />
                </div>
              )}
            </div>
          </Split.Pane>
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
}

export { SHELL_CONFIGURATION_TYPE };
