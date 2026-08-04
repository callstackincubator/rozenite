import { GridFour } from '@phosphor-icons/react';

import { ActionButton } from '../../components/action-button/action-button';
import { CommandLine } from '../../components/command-line/command-line';
import { ScreenshotSlot } from '../../components/screenshot/screenshot';
import styles from './hero.module.css';

export const Hero = () => (
  <header className={styles.hero}>
    <div className={styles.wash} aria-hidden="true" />
    <div className={styles.container}>
      <div className={styles.copy}>
        <h1 className={styles.title}>
          <span className={styles.titleLine}>Panels for DevTools.</span>
          <span className={[styles.titleLine, styles.titleMuted].join(' ')}>
            Tools for agents.
          </span>
        </h1>

        <p className={styles.lead}>
          Rozenite plugs debugging panels into React Native DevTools, then hands
          the same data to your coding agent.
        </p>

        <div className={styles.actions}>
          <ActionButton href="/docs/getting-started">Get started</ActionButton>
          <ActionButton href="/plugin-directory" variant="outline" icon={GridFour}>
            Browse plugins
          </ActionButton>
        </div>

        <CommandLine
          command="npx rozenite@latest init"
          className={styles.install}
        />
      </div>

      <div className={styles.visual}>
        <ScreenshotSlot shows="React Native DevTools with a Rozenite panel open next to Console, Sources and Network." />
      </div>
    </div>
  </header>
);
