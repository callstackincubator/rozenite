import { ActionButton } from '../../components/action-button/action-button';
import { CommandLine } from '../../components/command-line/command-line';
import { Reveal } from '../../components/reveal/reveal';
import { ScreenshotSlot } from '../../components/screenshot/screenshot';
import { Section } from '../../components/section/section';
import styles from './standalone.module.css';

/**
 * No eyebrow. The rationed labels belong to the product surfaces; the
 * standalone app is a way of working, not another target.
 */
export const Standalone = () => (
  <Section id="standalone">
    <Reveal>
      <div className={styles.header}>
        <h2 className={styles.title}>Rozenite on its own</h2>
        <p className={styles.body}>
          If Rozenite panels are where you spend your debugging time, run just those.{' '}
          <code className={styles.code}>rozenite open</code> connects straight to the device, so
          your panels stay put across app reloads — and they work the same way whichever target you
          are debugging.
        </p>

        <div className={styles.actions}>
          <CommandLine command="npx rozenite open" className={styles.command} />
          <ActionButton href="/docs/standalone-app" variant="outline">
            Standalone app guide
          </ActionButton>
        </div>
      </div>
    </Reveal>

    <Reveal>
      <ScreenshotSlot
        className={styles.shot}
        shows="The Rozenite standalone app in its own window, with a plugin panel open."
      />
    </Reveal>
  </Section>
);
