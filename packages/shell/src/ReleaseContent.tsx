import { Dialog } from '@rozenite/ui';
import { RozeniteLockup } from './Logo';

const METRO_CONFIGURATION_URL =
  'https://github.com/callstackincubator/rozenite/tree/main/packages/metro#configuration';
const ISSUES_URL = 'https://github.com/callstackincubator/rozenite/issues';

/**
 * Release-specific welcome content. Replace this component when preparing a
 * release that needs a welcome dialog.
 */
export function ReleaseContent() {
  return (
    <div className="space-y-4">
      <RozeniteLockup />
      <Dialog.Header>
        <Dialog.Title>We are changing</Dialog.Title>
        <Dialog.Description>The DevTools experience now uses a unified UI.</Dialog.Description>
      </Dialog.Header>
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          Plugin panels now live together in one place, with a consistent layout and appearance. The
          goal is to make Rozenite easier to move through and more comfortable to use day to day.
        </p>
        <p>
          Prefer the previous layout? Set{' '}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-foreground">
            pluginDisplay: 'tabs'
          </code>{' '}
          in the options passed to{' '}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-foreground">
            withRozenite
          </code>{' '}
          in your Metro config. See the{' '}
          <a
            className="text-primary underline underline-offset-4 hover:text-primary/80"
            href={METRO_CONFIGURATION_URL}
            rel="noreferrer"
            target="_blank"
          >
            Metro configuration reference
          </a>
          .
        </p>
        <p>
          Please report UI issues, plugin improvements, and requests for new plugins in the{' '}
          <a
            className="text-primary underline underline-offset-4 hover:text-primary/80"
            href={ISSUES_URL}
            rel="noreferrer"
            target="_blank"
          >
            Rozenite repository
          </a>
          .
        </p>
      </div>
    </div>
  );
}
