import { Badge, Card, DescriptionList, Link, PluginShell, ScrollArea } from '@rozenite/ui';
import { DebugCard } from '../debug/DebugCard';
import { isDebugEnabled } from '../debug/debug-mode';
import type { ShellPlugin } from '../types';

type PluginsScreenProps = {
  plugins: ShellPlugin[];
  /** pluginId -> latest published version, from `useOutdatedPlugins`. */
  outdated: Map<string, string>;
  runtimeVersion?: string;
  /** Latest published runtime version when one is newer, otherwise null. */
  runtimeUpdate: string | null;
};

const RELEASES_URL = 'https://github.com/callstackincubator/rozenite/releases';

export function PluginsScreen({
  plugins,
  outdated,
  runtimeVersion,
  runtimeUpdate,
}: PluginsScreenProps) {
  return (
    <PluginShell.Body>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold">Plugins</h1>
            <span className="text-sm text-muted-foreground">{plugins.length} installed</span>
          </div>
          {/* The cog's dot covers runtime updates too, and the footer link is
              hidden while the sidebar is collapsed, so the detail behind that
              dot has to be reachable here. */}
          {runtimeUpdate && (
            <Card>
              <Card.Header>
                <span className="font-medium">Rozenite update available</span>
                {runtimeVersion && (
                  <span className="text-sm text-muted-foreground">Installed v{runtimeVersion}</span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  <Link href={RELEASES_URL} external className="text-xs">
                    Release notes
                  </Link>
                  <Badge tone="neutral">v{runtimeUpdate}</Badge>
                </div>
              </Card.Header>
            </Card>
          )}
          <div className="flex flex-col gap-3">
            {plugins.map((plugin) => {
              const latestVersion = outdated.get(plugin.id);

              return (
                <Card key={plugin.id}>
                  <Card.Header>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{plugin.name}</span>
                      {/* Most manifests name the plugin after its package, so
                          the id is only worth a second line when it differs. */}
                      {plugin.id !== plugin.name && (
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {plugin.id}
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-3">
                      {latestVersion && (
                        <Link
                          href={`https://www.npmjs.com/package/${plugin.id}`}
                          external
                          className="text-xs"
                        >
                          Update to v{latestVersion}
                        </Link>
                      )}
                      <Badge tone="neutral">{plugin.version}</Badge>
                    </div>
                  </Card.Header>
                  <Card.Body className="flex flex-col gap-3">
                    {plugin.description && (
                      <p className="text-sm text-muted-foreground">{plugin.description}</p>
                    )}
                    <DescriptionList>
                      <DescriptionList.Item label="Panels">
                        {plugin.panels.length > 0
                          ? plugin.panels.map((panel) => panel.name).join(', ')
                          : '—'}
                      </DescriptionList.Item>
                    </DescriptionList>
                  </Card.Body>
                </Card>
              );
            })}
          </div>
          {isDebugEnabled() && <DebugCard plugins={plugins} runtimeVersion={runtimeVersion} />}
        </div>
      </ScrollArea>
    </PluginShell.Body>
  );
}
