import { RuntimeEvent, SDK } from './rn-devtools-frontend.js';

/**
 * The framework a React Native DevTools window is attached to.
 *
 * Rozenite for Web debugs a browser page through this very frontend (see
 * `@rozenite/chrome-extension`), so a window titled "React Native
 * DevTools" can just as easily be showing a web app as a native one —
 * which is exactly what this disambiguates. Lynx is listed for symmetry
 * with `@rozenite/app`'s `src/framework.ts` (keep the two readers in
 * sync) but is unreachable here: a Lynx dev server serves no Fusebox
 * frontend at all — `packages/middleware/src/middleware.ts` skips
 * `/rn_fusebox.html` on `platform: 'lynx'` — so a Lynx developer sees the
 * standalone app instead, which names the framework in its own footer.
 */
export type Framework = 'React Native' | 'Web' | 'Lynx';

const FRAMEWORKS: readonly Framework[] = ['React Native', 'Web', 'Lynx'];

/**
 * The framework this frontend is named after, and therefore the one it
 * says nothing extra about: a "React Native · ..." prefix inside a window
 * already titled "React Native DevTools" is noise. A React Native
 * developer's title is left exactly as the frontend built it, and the
 * label appears only when the target is something else.
 */
const IMPLIED_FRAMEWORK: Framework = 'React Native';

/**
 * Framework names as they appear in `ReactNativeApplication`'s
 * `integrationName`.
 *
 * That field is free-form — React Native's own values are host
 * integrations like "iOS Bridge (RCTBridge)" — so this recognises the
 * values Rozenite itself sends and lets everything else fall through to
 * the `platform` reading in `getFramework`.
 */
const FRAMEWORK_BY_INTEGRATION: Record<string, Framework> = {
  Lynx: 'Lynx',
};

const SEPARATOR = ' · ';

type ApplicationMetadata = {
  integrationName?: string;
  platform?: string;
};

type ApplicationModel = SDK.ReactNativeApplicationModel.ReactNativeApplicationModel;

/**
 * Which framework the connected target belongs to, read from the
 * `ReactNativeApplication.metadataUpdated` payload the frontend already
 * subscribes to for its own title.
 *
 * Two readings, in precedence order: an explicit `integrationName` this
 * build knows, then `platform === 'web'` — what
 * `@rozenite/chrome-extension` reports, and the only framework that *is*
 * a platform. Anything else is React Native rather than nothing:
 * `platform` is the device OS there (`ios`/`android`), so a future OS
 * must not silently cost the label.
 */
export const getFramework = (metadata: ApplicationMetadata): Framework => {
  const known =
    metadata.integrationName !== undefined
      ? FRAMEWORK_BY_INTEGRATION[metadata.integrationName]
      : undefined;

  if (known) {
    return known;
  }

  return metadata.platform === 'web' ? 'Web' : 'React Native';
};

const withoutFramework = (title: string): string => {
  const known = FRAMEWORKS.find((framework) => title.startsWith(`${framework}${SEPARATOR}`));

  return known ? title.slice(known.length + SEPARATOR.length) : title;
};

/**
 * The window title, with the framework in front of whatever the frontend
 * put there ("Web · MyApp (Chrome) - React Native DevTools") — or that
 * title untouched when the framework is the one this frontend already
 * implies (see `IMPLIED_FRAMEWORK`).
 *
 * A prefix rather than a suffix on purpose: several DevTools windows open
 * at once is the case this exists for, and a browser/OS window list
 * truncates the *end* of a title first — the frontend's own
 * "- React Native DevTools" tail is the first thing to go.
 *
 * Idempotent, and re-labelling replaces the previous label instead of
 * stacking a second one. Both matter: this runs again on every title
 * change, including the ones it makes itself.
 */
export const withFramework = (title: string, framework: Framework): string => {
  const base = withoutFramework(title);

  return framework === IMPLIED_FRAMEWORK ? base : `${framework}${SEPARATOR}${base}`;
};

/**
 * Keeps the framework in `document.title` for as long as the frontend is
 * open — for the frameworks that need naming. A React Native target's
 * title is never written to at all.
 *
 * The frontend owns that title: it rebuilds it from scratch (app display
 * name, device name, a `[PROFILING]` suffix) on every metadata or
 * system-state change, and would drop a label written once. So this
 * re-applies on every title mutation rather than assuming its own write is
 * the last one.
 */
export const trackFrameworkTitle = (): void => {
  let framework: Framework | null = null;

  const applyToTitle = (): void => {
    if (framework === null) {
      return;
    }

    const next = withFramework(document.title, framework);

    // Guarded so the observer below settles: `withFramework` is
    // idempotent, so a re-entrant run makes no further write.
    if (next !== document.title) {
      document.title = next;
    }
  };

  const handleMetadata = (metadata: ApplicationMetadata): void => {
    framework = getFramework(metadata);
    applyToTitle();
  };

  const titleElement = document.querySelector('title');

  if (titleElement) {
    // `document.title = ...` replaces the element's text, so watching its
    // children (and their data) catches every write the frontend makes.
    new MutationObserver(applyToTitle).observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  const onMetadataUpdated = (event: RuntimeEvent<ApplicationMetadata>): void => {
    handleMetadata(event.data);
  };

  const observer: SDK.TargetManager.SDKModelObserver<ApplicationModel> = {
    modelAdded: (model) => {
      // The frontend enables this domain for its own title; `ensure`
      // makes the ordering between the two irrelevant.
      model.ensureEnabled();
      model.addEventListener('MetadataUpdated', onMetadataUpdated, null);

      // Metadata can have arrived before this ever ran (the frontend
      // enables the domain during startup, this waits for the main pane
      // to exist), in which case no further event is coming.
      if (model.metadataCached) {
        handleMetadata(model.metadataCached);
      }
    },
    modelRemoved: (model) => {
      model.removeEventListener('MetadataUpdated', onMetadataUpdated, null);
    },
  };

  SDK.TargetManager.TargetManager.instance().observeModels(
    SDK.ReactNativeApplicationModel.ReactNativeApplicationModel,
    observer,
  );
};
