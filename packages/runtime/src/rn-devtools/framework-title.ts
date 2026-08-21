import { RuntimeEvent, SDK } from './rn-devtools-frontend.js';

/**
 * The framework a React Native DevTools window is attached to.
 *
 * Only two are reachable here. Rozenite for Web debugs a browser page
 * through this very frontend (see `@rozenite/chrome-extension`), so a
 * window titled "React Native DevTools" can just as easily be showing a
 * web app as a native one — which is exactly what this disambiguates.
 * Lynx never reaches this code at all: its dev server serves no Fusebox
 * frontend (`packages/middleware/src/middleware.ts` skips
 * `/rn_fusebox.html` on `platform: 'lynx'`), so a Lynx developer sees the
 * standalone `@rozenite/app` instead, which names the framework in its own
 * footer.
 */
export type Framework = 'React Native' | 'Web';

const FRAMEWORKS: readonly Framework[] = ['React Native', 'Web'];

const SEPARATOR = ' · ';

type ApplicationMetadata = {
  platform?: string;
};

type ApplicationModel = SDK.ReactNativeApplicationModel.ReactNativeApplicationModel;

/**
 * Which framework the connected target belongs to, read from the
 * `ReactNativeApplication.metadataUpdated` payload the frontend already
 * subscribes to for its own title.
 *
 * React Native reports the device OS here (`ios`/`android`);
 * `@rozenite/chrome-extension`, which answers the whole
 * `ReactNativeApplication` domain on behalf of a browser page, reports
 * `web`. Anything else is treated as React Native rather than dropped, so
 * a future OS never silently loses the label.
 */
export const getFramework = (metadata: ApplicationMetadata): Framework =>
  metadata.platform === 'web' ? 'Web' : 'React Native';

const withoutFramework = (title: string): string => {
  const known = FRAMEWORKS.find((framework) => title.startsWith(`${framework}${SEPARATOR}`));

  return known ? title.slice(known.length + SEPARATOR.length) : title;
};

/**
 * The window title, with the framework in front of whatever the frontend
 * put there ("Web · MyApp (Chrome) - React Native DevTools").
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
export const withFramework = (title: string, framework: Framework): string =>
  `${framework}${SEPARATOR}${withoutFramework(title)}`;

/**
 * Keeps the framework in `document.title` for as long as the frontend is
 * open.
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
