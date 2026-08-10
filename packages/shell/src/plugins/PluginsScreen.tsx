import { Badge, Card, DescriptionList, Link, PluginShell, ScrollArea } from '@rozenite/ui';
import type { ShellPlugin } from '../types';

type PluginsScreenProps = {
  plugins: ShellPlugin[];
  /** pluginId -> latest published version, from `useOutdatedPlugins`. */
  outdated: Map<string, string>;
};

export function PluginsScreen({ plugins, outdated }: PluginsScreenProps) {
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
                      <span className="font-medium">{plugin.name}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {plugin.id}
                      </span>
                    </div>
                    <Badge variant="secondary">{plugin.version}</Badge>
                    {latestVersion && (
                      <Link
                        href={`https://www.npmjs.com/package/${plugin.id}`}
                        external
                        className="text-xs"
                      >
                        Update to v{latestVersion}
                      </Link>
                    )}
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
        </div>
      </ScrollArea>
    </PluginShell.Body>
  );
}
