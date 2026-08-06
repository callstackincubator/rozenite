export const WELCOME_RELEASE_ID = '1.13.0';

/**
 * Release-specific welcome content. Replace this component and update
 * WELCOME_RELEASE_ID when preparing a release that needs a welcome dialog.
 */
export function ReleaseContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>
        Rozenite now brings your DevTools plugin panels together in one shared
        shell.
      </p>
      <p>
        Select a panel from the sidebar to start inspecting your application.
      </p>
    </div>
  );
}
