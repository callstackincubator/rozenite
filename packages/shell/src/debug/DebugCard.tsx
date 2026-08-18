import { Button, Card, DescriptionList, Switch } from '@rozenite/ui';
import {
  getVersionOverrides,
  getVersionOverridesRevision,
  setVersionOverride,
  subscribeToVersionOverrides,
} from '../npm/registry';
import type { ShellPlugin } from '../types';
import { useSyncExternalStore } from 'react';

const RUNTIME_PACKAGE_NAME = '@rozenite/runtime';

/** A version comfortably ahead of anything real, so the override reads as an
 *  update regardless of what is actually installed. */
function emulatedNewerVersion(currentVersion: string): string {
  const [major] = currentVersion.split('.');
  const majorNumber = Number.parseInt(major, 10);

  return `${Number.isNaN(majorNumber) ? 1 : majorNumber + 1}.0.0`;
}

type DebugCardProps = {
  plugins: ShellPlugin[];
  runtimeVersion?: string;
};

/** Drives the update states into view without waiting on a real npm release.
 *  Overrides are injected at the registry, so everything above it — the cog's
 *  dot, the footer link, the per-plugin npm link — runs its production path. */
export function DebugCard({ plugins, runtimeVersion }: DebugCardProps) {
  useSyncExternalStore(subscribeToVersionOverrides, getVersionOverridesRevision);
  const overrides = getVersionOverrides();

  const isRuntimeOverridden = overrides.has(RUNTIME_PACKAGE_NAME);
  const arePluginsOverridden = plugins.some((plugin) => overrides.has(plugin.id));

  const toggleRuntime = (emulate: boolean) => {
    setVersionOverride(
      RUNTIME_PACKAGE_NAME,
      emulate ? emulatedNewerVersion(runtimeVersion ?? '0.0.0') : null,
    );
  };

  const togglePlugins = (emulate: boolean) => {
    for (const plugin of plugins) {
      setVersionOverride(plugin.id, emulate ? emulatedNewerVersion(plugin.version) : null);
    }
  };

  const reset = () => {
    for (const packageName of [...overrides.keys()]) {
      setVersionOverride(packageName, null);
    }
  };

  return (
    <Card>
      <Card.Header>
        <span className="font-medium">Debug</span>
        <span className="text-xs text-muted-foreground">
          Emulated states, not real registry data
        </span>
        <Button variant="ghost" tone="neutral" size="sm" className="ml-auto" onClick={reset}>
          Reset
        </Button>
      </Card.Header>
      <Card.Body>
        <DescriptionList>
          <DescriptionList.Item label="Rozenite update available">
            <Switch
              checked={isRuntimeOverridden}
              onCheckedChange={toggleRuntime}
              disabled={!runtimeVersion}
            />
          </DescriptionList.Item>
          <DescriptionList.Item label="Plugin updates available">
            <Switch
              checked={arePluginsOverridden}
              onCheckedChange={togglePlugins}
              disabled={plugins.length === 0}
            />
          </DescriptionList.Item>
        </DescriptionList>
      </Card.Body>
    </Card>
  );
}
