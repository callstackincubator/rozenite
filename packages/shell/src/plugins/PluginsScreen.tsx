import { Badge, Card, DescriptionList, Link, PluginShell, ScrollArea } from '@rozenite/ui';
import { DebugCard } from '../debug/DebugCard';
import { isDebugEnabled } from '../debug/debug-mode';
import type { ShellPlugin } from '../types';

type PluginsScreenProps = {
  plugins: ShellPlugin[];
  /** pluginId -> latest published version, from `useOutdatedPlugins`. */
  outdated: Map<string, string>;
  runtimeVersion?: string;
};

export function PluginsScreen({ plugins, outdated, runtimeVersion }: PluginsScreenProps) {
  return (
    <PluginShell.Body>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold">Plugins</h1>
            <span className="text-sm text-muted-foreground">{plugins.length} installed</span>
          </div>
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
                      <Badge variant="secondary">{plugin.version}</Badge>
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
