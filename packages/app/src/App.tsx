import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Shell, type ShellPlugin } from '@rozenite/shell';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  IndicatorDot,
  Link,
  PluginShell,
  Separator,
} from '@rozenite/ui';
import { createDeviceShellHost } from './shell-host';
import { fetchConfig, type RozenitePlatform } from './config';
import { getFrameworkLabel } from './framework';
import { loadPlugins } from './plugins';
import type { DeviceConnection, DeviceState } from './connection/device-connection';
import { TargetUrlError } from './connection/target-from-url';
import { getTitleBarRegionClassName, WindowDragHandle } from './window-controls';

/** Where the "app running but Rozenite isn't installed" state points
 * people to install/initialize it. From the repo README's doc links. */
const SETUP_DOCS_URL = 'https://rozenite.dev/docs/getting-started';

type ConfigState =
  | { status: 'loading' }
  | {
      status: 'ready';
      plugins: ShellPlugin[];
      destroyOnDetachPlugins: string[];
      runtimeVersion?: string;
      platform?: RozenitePlatform;
    }
  | { status: 'error' };

/**
 * Loads `/rozenite/app/config` and the plugins it lists, once. Exposes a
 * `retry` to redo both after a failure (e.g. the dev server was down and is
 * now up).
 */
function useConfig(): [ConfigState, () => void] {
  const [state, setState] = useState<ConfigState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const config = await fetchConfig();
        const plugins = await loadPlugins(config.installedPlugins);
        if (!cancelled) {
          setState({
            status: 'ready',
            plugins,
            destroyOnDetachPlugins: config.destroyOnDetachPlugins,
            runtimeVersion: config.runtimeVersion,
            platform: config.platform,
          });
        }
      } catch (error) {
        console.error('[rozenite] Failed to load app configuration.', error);
        if (!cancelled) {
          setState({ status: 'error' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Both a `ConfigFetchError` from `fetchConfig` and a plugin-loading
    // failure collapse to the same `status: 'error'` here, since either is
    // equally fatal to mounting the shell.
  }, [attempt]);

  return [state, () => setAttempt((current) => current + 1)];
}

const STATUS_LABEL: Record<DeviceState['status'], string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  reloading: 'Reloading…',
  disconnected: 'Disconnected',
  rozeniteMissing: 'Rozenite not found',
  metroUnreachable: 'Dev server unreachable',
};

function StatusBadge({ status }: { status: DeviceState['status'] }) {
  const isProblem =
    status === 'disconnected' || status === 'rozeniteMissing' || status === 'metroUnreachable';

  return (
    <div className="flex items-center gap-2">
      <IndicatorDot tone={isProblem ? 'danger' : 'primary'} />
      <Badge variant={isProblem ? 'outline' : 'soft'}>{STATUS_LABEL[status]}</Badge>
    </div>
  );
}

function Footer({
  deviceState,
  targetName,
  platform,
  runtimeVersion,
}: {
  deviceState: DeviceState;
  targetName: string;
  platform?: RozenitePlatform;
  runtimeVersion?: string;
}) {
  const framework = getFrameworkLabel(platform);

  return (
    // A normal flex sibling below `Shell`, not an overlay: `Shell` is
    // given `className="min-h-0 flex-1"` below so it shares this column
    // with the footer instead of claiming the full viewport on its own —
    // see `ShellProps.className` in `@rozenite/shell`.
    <footer className="flex h-9 shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-sm text-muted-foreground">
      <StatusBadge status={deviceState.status} />
      {/* Independent of the connection: which framework this dev server
          serves comes from its config, so it stays readable while the app
          is connecting, reloading or disconnected. */}
      {framework && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span>{framework}</span>
        </>
      )}
      {(deviceState.status === 'connected' || deviceState.status === 'reloading') && targetName && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span className="truncate">{targetName}</span>
        </>
      )}
      {runtimeVersion && (
        <>
          <div className="flex-1" />
          <span>v{runtimeVersion}</span>
        </>
      )}
    </footer>
  );
}

/**
 * A dialog for a condition that needs the person's attention and, usually,
 * an action from them. Always rendered *over* whatever else is on screen —
 * including a mounted `Shell` — never in its place. See the comment above
 * `shellMounted` in `ConnectedApp` for why that matters.
 */
function StatusDialog({
  open,
  title,
  description,
  action,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
        </Dialog.Header>
        {action && <Dialog.Footer>{action}</Dialog.Footer>}
      </Dialog.Content>
    </Dialog>
  );
}

function ConnectedApp({ connection }: { connection: DeviceConnection }) {
  const deviceState = useSyncExternalStore(connection.subscribe, connection.getState);
  // Reactive despite `getTarget()` not itself being part of `DeviceState`:
  // it's driven through the very same `subscribe` connection.getState is,
  // so a display-only name update (see `device-connection.ts`'s
  // `setDeviceName`) reaches this render even when `deviceState` itself
  // doesn't change.
  const targetName = useSyncExternalStore(connection.subscribe, () => connection.getTarget().name);
  // `host` must stay referentially stable for as long as `connection` does —
  // `Shell` resubscribes from it whenever the reference changes.
  const host = useMemo(() => createDeviceShellHost(connection), [connection]);
  const [configState, retryConfig] = useConfig();

  // Sticky latch: once the shell has mounted, it stays mounted forever,
  // regardless of what `deviceState` or `configState` do afterwards.
  //
  // Panels surviving a JS-VM reload is the entire headline feature of this
  // app — people have been asking for exactly this. Unmounting `Shell` on
  // `reloading` or `disconnected` (or on `metroUnreachable`/`rozeniteMissing`
  // surfacing mid-session, e.g. because the dispatcher didn't come back
  // after a reload) would destroy every panel's state right when surviving
  // that is the point. So every non-connected state below is rendered as a
  // dialog *over* the still-mounted shell, never in its place.
  //
  // The config used to render `Shell` is latched alongside the boolean, in
  // a ref rather than read live off `configState`: `retryConfig` can put
  // `configState` back into `loading`/`error` (today only reachable from a
  // dialog that's unmounted while the shell is up, but the guarantee below
  // must not depend on that staying true) and the render condition must
  // not re-check `configState.status` at that point, or it would unmount
  // `Shell` right when the whole point is that it never does.
  const [shellMounted, setShellMounted] = useState(false);
  const mountedConfigRef = useRef<Extract<ConfigState, { status: 'ready' }> | null>(null);
  useEffect(() => {
    if (deviceState.status === 'connected' && configState.status === 'ready') {
      mountedConfigRef.current = configState;
      setShellMounted(true);
    }
  }, [deviceState.status, configState]);

  const configFailed = configState.status === 'error';

  return (
    // `PluginShell` supplies both the design tokens (dark mode, background,
    // etc.) and the portal container `Dialog` needs to render into
    // (`usePluginPortalContainer`) — without it, a `Dialog` here would have
    // nowhere to portal to and would render nothing. `Shell` below brings
    // its own nested `PluginShell` for its own children; this outer one is
    // for everything *around* `Shell` (the dialogs and footer below).
    <PluginShell>
      {shellMounted && mountedConfigRef.current ? (
        <Shell
          plugins={mountedConfigRef.current.plugins}
          destroyOnDetachPlugins={mountedConfigRef.current.destroyOnDetachPlugins}
          runtimeVersion={mountedConfigRef.current.runtimeVersion}
          host={host}
          // `Shell`'s own root defaults to `h-screen` (right for the
          // embedded DevTools case, where it's the whole page) — `h-full`
          // is in the same `tailwind-merge` group, so it wins over that
          // default instead of stacking with it. Here `Shell` shares this
          // outer `PluginShell`'s flex column with the footer below, so it
          // must size to the space that column leaves it (`min-h-0
          // flex-1`) instead of claiming the full viewport itself.
          className="h-full min-h-0 flex-1"
          // Reserves space for the Electron window's traffic lights in the
          // sidebar's own header instead of a full-width bar above
          // everything — see `getTitleBarRegionClassName`.
          sidebarHeaderClassName={getTitleBarRegionClassName()}
        />
      ) : (
        !configFailed && (
          <>
            <WindowDragHandle />
            <PluginShell.Body className="items-center justify-center">
              <EmptyState
                title={
                  configState.status === 'loading' ? 'Loading plugins…' : 'Connecting to device…'
                }
                description={targetName || undefined}
              />
            </PluginShell.Body>
          </>
        )
      )}

      <StatusDialog
        open={configFailed}
        title="Can't reach the dev server"
        description="The dev server this app is served by isn't responding. Make sure Metro is still running, then retry."
        action={<Button onClick={retryConfig}>Retry</Button>}
      />
      <StatusDialog
        open={!configFailed && deviceState.status === 'metroUnreachable'}
        title="Can't reach the dev server"
        description="Metro isn't responding right now. Make sure it's still running, then retry."
        action={<Button onClick={() => connection.reconnect()}>Retry</Button>}
      />
      <StatusDialog
        open={!configFailed && deviceState.status === 'rozeniteMissing'}
        title="Rozenite isn't set up in this app"
        description="The app is running, but the Rozenite runtime wasn't found in it. Follow the setup guide, then check again."
        action={
          <>
            <Link href={SETUP_DOCS_URL} external>
              Setup guide
            </Link>
            <Button onClick={() => connection.reconnect()}>Check again</Button>
          </>
        }
      />
      <StatusDialog
        open={!configFailed && deviceState.status === 'disconnected'}
        title="Connection lost"
        description="The connection to the device was lost. This can happen for a number of reasons; reconnect to try again."
        action={<Button onClick={() => connection.reconnect()}>Reconnect</Button>}
      />

      <Footer
        deviceState={deviceState}
        targetName={targetName}
        platform={
          configState.status === 'ready' ? configState.platform : mountedConfigRef.current?.platform
        }
        runtimeVersion={
          configState.status === 'ready'
            ? configState.runtimeVersion
            : mountedConfigRef.current?.runtimeVersion
        }
      />
    </PluginShell>
  );
}

export type AppTarget =
  | { kind: 'error'; error: TargetUrlError }
  | { kind: 'connection'; connection: DeviceConnection };

export function App({ target }: { target: AppTarget }) {
  if (target.kind === 'error') {
    return (
      <PluginShell>
        <WindowDragHandle />
        <PluginShell.Body className="items-center justify-center">
          <EmptyState
            title="No device to connect to"
            description={`${target.error.message} This app is meant to be launched with \`rozenite open\`, which fills in that connection for you — try that instead of opening this URL directly.`}
          />
        </PluginShell.Body>
      </PluginShell>
    );
  }

  return <ConnectedApp connection={target.connection} />;
}
