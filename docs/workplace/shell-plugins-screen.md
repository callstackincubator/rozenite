# Shell Plugins Screen

## Status

Draft for review. Derived from a confirmed statement of intent and from
investigation evidence recorded under "Findings". The worker must treat the
decisions and non-goals in this document as requirements. If implementation
evidence invalidates a decision, stop and ask for direction instead of
silently changing the design.

## Objective

Give shell mode a screen that answers "what plugins do I have, what do they
expose, and are they current?".

Shell mode collapsed every plugin behind a single DevTools tab, which removed
the only surface that showed what was actually loaded. The screen restores
that visibility. It is an inventory, not a diagnostic tool: a plugin that
fails to load never reaches shell at all and therefore cannot appear here.

For each plugin the screen shows:

- package id
- description
- installed version, and a link to npm when a newer version exists
- panels contributed by the plugin

## Non-goals

These are explicitly out of scope. Do not add them opportunistically.

- A Settings container or nested settings navigation.
- An About screen. The runtime version already surfaces through
  `WelcomeDialog` and the sidebar footer.
- A generic notices registry or any plugin-facing notification API.
- A "copy diagnostics" action.
- A `Skeleton` component in `@rozenite/ui`.
- Semantic `Badge` variants. The only consumer was the agent tools row.
- Any display of agent tools.
- A server-side npm proxy in `@rozenite/middleware`.

The last two are deferred, not rejected. See "Deferred decisions".

## Findings

Three investigation results constrain the design. They are recorded here
because the design is only correct while they hold.

### npm `/latest` is uncached and rate limited; the abbreviated packument is not

Measured against the live registry with 26 `@rozenite/*` packages:

| Endpoint | 780 requests (30 rounds x 26) | `cf-cache-status` |
| --- | --- | --- |
| `GET /<pkg>/latest` | 312 x HTTP 429, 7.6s, then a ~9 minute IP-wide ban | `DYNAMIC` |
| `GET /<pkg>` with `Accept: application/vnd.npm.install-v1+json` | 780 x HTTP 200, 2.2s | `HIT` (773), `REVALIDATED` (7) |

The abbreviated packument is CDN-cached, carries
`cache-control: public, max-age=300`, and is the endpoint the npm CLI itself
uses. It costs ~28KB per package against ~2.2KB for `/latest`, and its data
can be up to 5 minutes stale. Both costs are accepted.

`packages/shell/src/new-version.ts` currently uses `/latest`. That is the
uncached endpoint and must change regardless of the rest of this work.

### Plugin version is already fetched, then discarded

`RozeniteManifest` declares `version` (`packages/runtime/src/manifest.ts`).
`loadPluginFromUrl` logs it (`packages/runtime/src/plugin-loader.ts`) but does
not return it, so it never reaches `ShellPlugin`. No protocol change is
required to expose it.

## Agreed architecture

### Navigation

A cog button in the sidebar footer opens a flat Plugins screen. There is no
intermediate settings container.

The screen replaces the panel iframe area. The sidebar stays mounted and
visible. Panel iframes must not unmount while the screen is open, otherwise
every plugin loses its state on a visit. Note that plugins listed in
`destroyOnDetachPlugins` are already torn down when inactive; that existing
behavior is unchanged and the screen must not extend it to other plugins.

`ShellSelection` currently addresses a panel. It gains a screen case:

```ts
type ShellSelection =
  | { kind: 'panel'; pluginId: string; panelId: string }
  | { kind: 'plugins' };
```

`getInitialSelection` and the reconciliation effect in `Shell.tsx` keep their
current behavior for the panel case. Selecting the cog sets `{ kind: 'plugins' }`
and leaves the previously selected panel recorded so returning is possible.

Selection is single-valued. While the Plugins screen is open the cog renders
selected and no sidebar panel item renders selected; the remembered panel is
restored, with its highlight, when the user navigates back to it. Two
simultaneous selected affordances are not allowed.

### Sidebar footer

```
expanded:   [ Update v1.2.3 ->  .................... ] [cog +dot] [collapse]
collapsed:  [cog +dot] [collapse]
```

- The runtime update link keeps its current prominent text treatment. It is
  already conditional and costs nothing when the runtime is current.
- The cog carries an `IndicatorDot` when any plugin has an update. Plugin
  updates get no other affordance anywhere in the UI.
- Today the runtime update link is hidden entirely when the sidebar collapses.
  That is a defect. When collapsed, the runtime update must remain reachable:
  the cog's dot covers both signals and the Plugins screen carries the detail.
- The collapsed rail is 48px, too narrow for two icon buttons side by side.
  The footer stacks vertically when collapsed. Laying them out in a row clips
  the collapse button and strands the user with no way to expand again.

### npm version checking

One module, used by every npm version check in shell.

```ts
// packages/shell/src/npm/registry.ts

/** Latest published version for each package, from the CDN-cached
 *  abbreviated packument. Packages that fail to resolve are omitted. */
export function getLatestVersions(
  packageNames: string[],
): Promise<Map<string, string>>;

/** Semver-ish comparison. Returns false when `candidate` is not strictly
 *  newer, including when it is a local or prerelease build ahead of npm. */
export function isNewerVersion(current: string, candidate: string): boolean;
```

Requirements:

- Requests use `Accept: application/vnd.npm.install-v1+json` against
  `https://registry.npmjs.org/<encoded name>` and read `dist-tags.latest`.
- Results are cached at module level for the lifetime of the shell document.
  Mounting and unmounting the screen must not refetch.
- Failure is silent. A registry outage must never surface an error state in
  DevTools. Individual package failures are omitted from the result rather
  than rejecting the whole call.
- `new-version.ts` is refactored onto this module and deleted as a separate
  fetch path. `NewVersionFooter` and the Plugins screen must share one
  in-flight request, not two.

This also fixes an existing defect: `new-version.ts` compares with
`latestVersion === currentVersion`, so a local build newer than npm currently
reports a spurious update. `isNewerVersion` replaces that. Equivalent logic
already exists in `packages/chrome-extension/src/update-checker.ts`; that
package cannot be imported from shell, so the shell implementation is written
fresh and unit tested rather than shared.

### `useOutdatedPlugins`

```ts
// packages/shell/src/plugins/use-outdated-plugins.ts

export function useOutdatedPlugins(plugins: ShellPlugin[]): {
  status: 'loading' | 'ready' | 'unavailable';
  /** pluginId -> latest published version. Only entries strictly newer
   *  than the installed version are present. */
  outdated: Map<string, string>;
};
```

Requirements:

- This hook is the only caller of `getLatestVersions` for plugin packages.
- The footer consumes `outdated.size > 0` and nothing else. The cog must not
  know that npm, semver, or fetching exist.
- `status: 'unavailable'` renders no dot and no error affordance.

Do not generalize this into a notices abstraction. A second kind of notice
does not exist yet.

### Debug affordance

The update states cannot otherwise be reached without a real npm release, so
shell carries a debug panel that emulates them.

Overrides are injected at the registry, not at the components:

```ts
// packages/shell/src/npm/registry.ts
export function setVersionOverride(packageName: string, version: string | null): void;
```

`getLatestVersion` consults the override map before both its cache and the
network. Everything above it — `useOutdatedPlugins`, the cog's dot,
`NewVersionFooter`, the per-plugin npm link — therefore runs its production
path against emulated data. A parallel "pretend" flag in the components would
leave the real path unexercised and is not acceptable.

Overrides persist in `sessionStorage` so a reload keeps the emulated state,
which is what makes the initial-load path testable. Consumers re-resolve
through `subscribeToVersionOverrides` / `getVersionOverridesRevision`.

Gating lives in one module (`packages/shell/src/debug/debug-mode.ts`):
`import.meta.env.DEV`, or `localStorage['rozenite.debug'] === '1'` so a
released build can be driven into these states when reproducing a report.

The panel renders as the last `Card` on the Plugins screen and is absent
entirely when the flag is off.

### Screen layout

```
PluginShell.Body
  ScrollArea
    header: "Plugins" + "N installed"
    Card per plugin
      title row:  <name>  ......  [Link -> npm, when outdated]  [Badge: version]
      description
      DescriptionList
        Panels      <panel names>
```

`DescriptionList` carries a single row today. It stays a list rather than a
bare label/value pair because agent tools are a deferred second row and
because the component is shared (see "`@rozenite/ui` changes").

When the runtime itself is behind, a notice card precedes the plugin list with
the installed version, the latest version, and a link to the release notes.
That is the detail the cog's dot promises when the sidebar is collapsed and
the footer link is out of reach. It is a single conditional row, not the
About screen the non-goals rule out: it appears only when an update exists.

Version and npm link are right-aligned; the title keeps the left edge. Most
manifests set `name` to the package name, so the package id renders as a
second title line only when the two actually differ.

Plugins are listed in the order shell receives them. No search, no sort, no
filtering; the expected population is under thirty entries.

## `@rozenite/ui` changes

Each component below ships with a story in `apps/ui-storybook/src/stories/`
per `agents/working-on-ui-components.md`, and is exported from
`packages/ui/src/index.ts` with its prop types.

### New components

| Component | API | Rationale |
| --- | --- | --- |
| `Separator` | `orientation?: 'horizontal' \| 'vertical'` | Extracted from `Toolbar.Separator`, which remains as an alias to the new component. No behavior change for existing consumers. |
| `Link` | anchor props, `external?: boolean` | `NewVersionFooter` hand-rolls ~8 utility classes for exactly this; the screen is the second consumer. External links render the trailing arrow affordance and set `rel="noreferrer" target="_blank"`. |
| `IndicatorDot` | `variant?`, sizing via className | Standalone so it can be composed into any adornment slot rather than special-cased on one component. |
| `DescriptionList` | `DescriptionList` + `DescriptionList.Item` with `label` and `children` | See below. |
| `Card` | `Card` + `Card.Header` + `Card.Body`, `collapsible?: boolean` | See below. |

`DescriptionList` and `Card` are not speculative. Both already exist,
independently reinvented, inside `network-activity-plugin`:
`src/ui/components/KeyValueGrid.tsx` is a description list and
`src/ui/components/Section.tsx` is a collapsible card, and `HeadersTab.tsx`
composes them exactly as this screen will. `storage-plugin` and `mmkv-plugin`
hand-roll stacked label/value pairs in their entry detail dialogs. The
"wait for a second consumer" bar is already met twice over.

Migrating `network-activity-plugin` onto the shared components is desirable
but is a separate change and must not be bundled into this one. That plugin
also carries its own `ScrollArea` and `cn` duplicating `@rozenite/ui`; note it
and leave it.

### Modified components

| Component | Change |
| --- | --- |
| `Button` | New `adornment?: ReactNode` slot, rendered after children. Used to host `IndicatorDot` on the cog. Do not add an indicator-specific prop. |
| `Sidebar` | Add `Sidebar.Header` and `Sidebar.Footer`. `Shell.tsx` currently hand-rolls both as raw `<header>`/`<footer>` with sticky and border classes; that markup moves into the components. |

The existing `Badge` is used unchanged for the version label. Semantic
variants were dropped along with the agent tools row; add them when something
actually needs them.

## Runtime changes

`packages/runtime/src/plugin-loader.ts`:

- `LoadedPlugin` gains `version: string`.
- `loadPluginFromUrl` returns `manifest.version`.

`packages/shell/src/types.ts`:

- `ShellPlugin` gains `version: string`.

No change to `global-namespace.ts`, `entry-point.ts`, or the `postMessage`
contract. The value already travels inside `shellConfiguration`.

## Testing

- `registry.ts`: unit tests for `isNewerVersion` covering equal versions,
  patch/minor/major increments, differing segment counts, and a local build
  ahead of npm. Network calls are mocked; no test hits the registry.
- `use-outdated-plugins.ts`: caching (one fetch across two mounts), silent
  failure producing `unavailable`, and correct filtering to strictly-newer.
- `selection.ts`: existing tests extended for the `plugins` screen case,
  including that panel selection survives a visit to the screen.
- Storybook stories for every new and modified `@rozenite/ui` component,
  verified in the browser per `agents/working-on-ui-components.md`.
- Existing `NewVersionFooter` tests updated for the shared module.

## Version plan

Required. `@rozenite/ui`, `@rozenite/shell`, and `@rozenite/runtime` all
change behavior, and `@rozenite/*` packages are pinned in lockstep. Create it
with `pnpm changeset` per `docs/agents/version-plans.md`.

## Deferred decisions

These are recorded so they are not rediscovered later.

**Server-side version caching.** A `GET /rozenite/plugin-versions` route in
the middleware would collapse N-reloads-by-M-plugins into M fetches per server
lifetime, and `auto-discovery.ts` already exposes each plugin's on-disk path so
installed versions need no network call at all. The CDN-cached endpoint makes
this unnecessary for correctness. Revisit if request volume becomes a concern.

**Agent tools.** Cut from this change. The investigation is recorded here so it
does not have to be repeated.

Where tools live:

- Every plugin that exposes agent tools registers them from `src/react-native/`,
  i.e. from the app, never from panel code. Ten plugins were checked; there are
  zero panel-side registrations. A message sent to a panel iframe asking for its
  tools would come back empty from every plugin.
- Registration is fire-and-forget. `useRozenitePluginAgentTool`
  (`packages/agent-bridge/src/useRozeniteAgentTool.ts`) sends `register-tool` on
  mount and re-sends on `agent-session-ready`. Nothing app-side retains a
  registry; the accumulator lives in the middleware session
  (`packages/middleware/src/agent/session.ts`).
- Tools are qualified `` `${pluginId}.${toolName}` ``, so attribution back to a
  plugin is a prefix match with no new plumbing.

Two ways to read them, both viable:

1. *Middleware session.* `GET /rozenite/agent/sessions` then
   `GET /rozenite/agent/sessions/:id/tools`, same-origin from shell since the
   middleware serves both. No protocol change, but requires an active CLI agent
   session, which is the uncommon case.
2. *App bridge query.* Shell opens its own `plugin-bridge` client for
   `AGENT_PLUGIN_ID` and asks the app directly. The transport already works:
   `getPanelChannel` posts to `window.parent` and `plugin-view.ts` forwards to
   the app over CDP. Needs a module-level tool registry plus a `list-tools`
   handler added to `@rozenite/agent-bridge`. Works with no agent session.

Option 2 is the better end state. It requires a change to a published package.

Constraint that survives both options: tools exist only while their hook is
mounted, so neither approach can report what a plugin *defines* — only what is
live at that moment. Whatever ships must label the row accordingly ("Active
tools", with an app-not-connected state) rather than implying a capability
list.

Declaring tools statically in `rozenite.json` was considered and rejected:
plugin authors should not have to hand-maintain a list that can drift from what
actually registers.

## Resolved questions

1. **Sidebar selected state.** The cog renders selected while the screen is
   open, and selection stays single-valued. See "Navigation".
2. **Alternate entry points.** None. The cog is the only way into the screen.
   The welcome dialog does not link to it.
